"""
HLB보컬 - RMVPE 피치 추출기
RMVPE(Robust Model for Voice Pitch Estimation) 기반 F0 추출.
RMVPE 모델이 없는 경우 librosa의 pyin을 폴백으로 사용한다.
"""

import logging
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# RMVPE 모델 아키텍처 (간소화)
# ──────────────────────────────────────────────

class BiGRU(nn.Module):
    """양방향 GRU 레이어"""

    def __init__(self, input_features: int, hidden_features: int, num_layers: int):
        super().__init__()
        self.gru = nn.GRU(
            input_features, hidden_features, num_layers=num_layers,
            batch_first=True, bidirectional=True,
        )

    def forward(self, x):
        return self.gru(x)[0]


class ConvBlockRes(nn.Module):
    """잔차 연결이 있는 컨볼루션 블록"""

    def __init__(self, in_channels: int, out_channels: int, momentum: float = 0.01):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, 3, 1, 1),
            nn.BatchNorm2d(out_channels, momentum=momentum),
            nn.ReLU(),
            nn.Conv2d(out_channels, out_channels, 3, 1, 1),
            nn.BatchNorm2d(out_channels, momentum=momentum),
            nn.ReLU(),
        )
        if in_channels != out_channels:
            self.shortcut = nn.Conv2d(in_channels, out_channels, 1, 1, 0)
        else:
            self.shortcut = nn.Identity()

    def forward(self, x):
        return self.conv(x) + self.shortcut(x)


class ResEncoderBlock(nn.Module):
    """인코더 블록"""

    def __init__(self, in_channels: int, out_channels: int, kernel_size: tuple,
                 n_blocks: int = 1, momentum: float = 0.01):
        super().__init__()
        self.n_blocks = n_blocks
        self.conv = nn.ModuleList()
        self.conv.append(ConvBlockRes(in_channels, out_channels, momentum))
        for _ in range(n_blocks - 1):
            self.conv.append(ConvBlockRes(out_channels, out_channels, momentum))
        self.pool = nn.AvgPool2d(kernel_size=kernel_size)

    def forward(self, x):
        for conv in self.conv:
            x = conv(x)
        return self.pool(x), x


class ResDecoderBlock(nn.Module):
    """디코더 블록"""

    def __init__(self, in_channels: int, out_channels: int, stride: tuple,
                 n_blocks: int = 1, momentum: float = 0.01):
        super().__init__()
        self.n_blocks = n_blocks
        self.conv = nn.ModuleList()
        self.conv.append(ConvBlockRes(2 * in_channels, out_channels, momentum))
        for _ in range(n_blocks - 1):
            self.conv.append(ConvBlockRes(out_channels, out_channels, momentum))
        self.up = nn.ConvTranspose2d(
            in_channels, in_channels, stride, stride=stride
        )

    def forward(self, x, concat_tensor):
        x = self.up(x)
        # 크기 맞추기
        diff_h = concat_tensor.size(2) - x.size(2)
        diff_w = concat_tensor.size(3) - x.size(3)
        x = F.pad(x, [0, diff_w, 0, diff_h])
        x = torch.cat([x, concat_tensor], dim=1)
        for conv in self.conv:
            x = conv(x)
        return x


class DeepUnet(nn.Module):
    """RMVPE의 Deep U-Net 백본"""

    def __init__(
        self,
        kernel_size: tuple = (2, 2),
        n_blocks: int = 1,
        en_de_layers: int = 5,
        inter_layers: int = 4,
        in_channels: int = 1,
        en_out_channels: int = 16,
    ):
        super().__init__()
        self.encoder = nn.ModuleList()
        self.decoder = nn.ModuleList()
        self.inter = nn.ModuleList()

        # 인코더
        for i in range(en_de_layers):
            in_c = in_channels if i == 0 else en_out_channels * (2 ** (i - 1))
            out_c = en_out_channels * (2 ** i)
            self.encoder.append(
                ResEncoderBlock(in_c, out_c, kernel_size, n_blocks)
            )

        # 중간 레이어
        mid_c = en_out_channels * (2 ** (en_de_layers - 1))
        for i in range(inter_layers):
            self.inter.append(ConvBlockRes(mid_c, mid_c))

        # 디코더
        for i in range(en_de_layers - 1, -1, -1):
            in_c = en_out_channels * (2 ** i)
            out_c = en_out_channels * (2 ** (i - 1)) if i > 0 else en_out_channels
            self.decoder.append(
                ResDecoderBlock(in_c, out_c, kernel_size, n_blocks)
            )

    def forward(self, x):
        concat_tensors = []
        for encoder in self.encoder:
            x, concat = encoder(x)
            concat_tensors.append(concat)

        for inter in self.inter:
            x = inter(x)

        for i, decoder in enumerate(self.decoder):
            x = decoder(x, concat_tensors[-(i + 1)])

        return x


class E2E(nn.Module):
    """RMVPE End-to-End 모델"""

    def __init__(self, n_blocks: int, n_gru: int, kernel_size: tuple,
                 en_de_layers: int = 5, inter_layers: int = 4,
                 in_channels: int = 1, en_out_channels: int = 16):
        super().__init__()
        self.unet = DeepUnet(kernel_size, n_blocks, en_de_layers,
                             inter_layers, in_channels, en_out_channels)
        self.cnn = nn.Conv2d(en_out_channels, 3, (3, 3), padding=(1, 1))
        if n_gru:
            self.fc = nn.Sequential(
                BiGRU(3 * 128, 256, n_gru),
                nn.Linear(512, 360),
                nn.Dropout(0.25),
                nn.Sigmoid(),
            )
        else:
            self.fc = nn.Sequential(
                nn.Linear(3 * 128, 360),
                nn.Dropout(0.25),
                nn.Sigmoid(),
            )

    def forward(self, mel):
        # mel: [B, T, 128] → [B, 1, 128, T] for Conv2d
        mel = mel.transpose(-1, -2).unsqueeze(1)
        x = self.cnn(self.unet(mel))  # [B, 3, H, W=T]
        # → [B, T, 3, H] → [B, T, 3*H=384] for BiGRU(input_features=384)
        x = x.permute(0, 3, 1, 2).flatten(-2)
        x = self.fc(x)
        return x


# ──────────────────────────────────────────────
# RMVPE 래퍼 클래스
# ──────────────────────────────────────────────

class RMVPE:
    """
    RMVPE 피치 추출기 래퍼.
    모델이 로드되면 GPU/CPU에서 F0를 추출한다.
    모델이 없는 경우 librosa pyin으로 폴백한다.
    """

    # 센트 -> Hz 변환 테이블 (RMVPE 출력은 360 bin, 20Hz ~ 1600Hz)
    CENTS_MAPPING = np.array([
        20.0 * 2 ** (i / 120.0) for i in range(360)
    ])

    def __init__(self, model_path: Optional[str] = None, device: str = "cpu", is_half: bool = False):
        self.device = device
        self.is_half = is_half
        self.model = None

        if model_path and Path(model_path).exists():
            try:
                self._load_model(model_path)
                logger.info("RMVPE 모델 로드 완료: %s", model_path)
            except Exception as e:
                logger.warning("RMVPE 모델 로드 실패, pyin 폴백 사용: %s", e)
                self.model = None
        else:
            logger.info("RMVPE 모델 파일 없음, pyin 폴백 사용")

    def _load_model(self, model_path: str):
        """RMVPE 모델 가중치 로드"""
        self.model = E2E(n_blocks=1, n_gru=2, kernel_size=(2, 2))
        ckpt = torch.load(model_path, map_location="cpu", weights_only=False)
        # state_dict 키가 'model'로 래핑된 경우 처리
        if isinstance(ckpt, dict) and "model" in ckpt:
            ckpt = ckpt["model"]
        self.model.load_state_dict(ckpt, strict=False)
        self.model.eval()
        self.model = self.model.to(self.device)
        if self.is_half:
            self.model = self.model.half()

    def extract_f0(
        self,
        audio: np.ndarray,
        sr: int = 16000,
        f0_min: float = 50.0,
        f0_max: float = 1100.0,
        hop_length: int = 160,
    ) -> np.ndarray:
        """
        오디오에서 F0(기본 주파수) 추출.

        Args:
            audio: 모노 오디오 신호 (float32, -1~1 범위)
            sr: 샘플레이트 (RMVPE는 16kHz 기대)
            f0_min: 최소 F0 (Hz)
            f0_max: 최대 F0 (Hz)
            hop_length: 홉 사이즈

        Returns:
            F0 배열 (Hz, 무성음 구간은 0)
        """
        if self.model is not None:
            return self._extract_f0_rmvpe(audio, sr, f0_min, f0_max, hop_length)
        else:
            return self._extract_f0_pyin(audio, sr, f0_min, f0_max, hop_length)

    def _extract_f0_rmvpe(
        self, audio: np.ndarray, sr: int, f0_min: float, f0_max: float, hop_length: int
    ) -> np.ndarray:
        """RMVPE 모델로 F0 추출"""
        import librosa

        # 16kHz로 리샘플링
        if sr != 16000:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)

        # 멜 스펙트로그램 계산
        n_fft = 1024
        win_length = 1024
        mel_spec = librosa.feature.melspectrogram(
            y=audio, sr=16000, n_fft=n_fft, hop_length=160,
            win_length=win_length, n_mels=128, fmin=30, fmax=8000,
        )
        mel_spec = np.log(np.clip(mel_spec, a_min=1e-6, a_max=None))

        mel_tensor = torch.from_numpy(mel_spec.T).float().unsqueeze(0).to(self.device)
        if self.is_half:
            mel_tensor = mel_tensor.half()

        with torch.no_grad():
            output = self.model(mel_tensor)

        # 출력을 F0로 변환
        output = output.squeeze(0).cpu().numpy()
        f0 = self._decode_f0(output, f0_min, f0_max)

        # 원래 hop_length에 맞게 리샘플링
        if hop_length != 160:
            import scipy.interpolate
            original_len = len(f0)
            target_len = int(len(audio) * sr / 16000 / hop_length)
            if original_len > 0 and target_len > 0:
                x_old = np.linspace(0, 1, original_len)
                x_new = np.linspace(0, 1, target_len)
                f0 = np.interp(x_new, x_old, f0)

        return f0

    def _decode_f0(self, output: np.ndarray, f0_min: float, f0_max: float) -> np.ndarray:
        """RMVPE 출력(확률)을 F0 Hz 값으로 변환"""
        # 각 프레임에서 가장 높은 확률의 bin 찾기
        # 가중 평균으로 더 정확한 F0 추정
        f0 = np.zeros(output.shape[0])

        for i in range(output.shape[0]):
            probs = output[i]
            # 임계값 이상인 bin만 사용
            threshold = 0.3
            if np.max(probs) < threshold:
                f0[i] = 0.0
                continue

            # 가중 평균으로 F0 계산
            center = np.argmax(probs)
            start = max(0, center - 4)
            end = min(360, center + 5)

            weights = probs[start:end]
            if weights.sum() > 0:
                cents = self.CENTS_MAPPING[start:end]
                f0_val = np.sum(weights * cents) / weights.sum()
            else:
                f0_val = self.CENTS_MAPPING[center]

            # 범위 체크
            if f0_min <= f0_val <= f0_max:
                f0[i] = f0_val
            else:
                f0[i] = 0.0

        return f0

    def _extract_f0_pyin(
        self, audio: np.ndarray, sr: int, f0_min: float, f0_max: float, hop_length: int
    ) -> np.ndarray:
        """librosa pyin으로 F0 추출 (폴백)"""
        import librosa

        f0, voiced_flag, voiced_probs = librosa.pyin(
            audio,
            fmin=f0_min,
            fmax=f0_max,
            sr=sr,
            hop_length=hop_length,
            fill_na=0.0,
        )

        if f0 is None:
            # 오디오 길이 기반으로 빈 F0 배열 반환
            n_frames = 1 + len(audio) // hop_length
            return np.zeros(n_frames, dtype=np.float32)

        # NaN을 0으로 대체
        f0 = np.nan_to_num(f0, nan=0.0)
        return f0.astype(np.float32)
