"""
VocalMind Modal - RVC v2 음성 변환 (추론)
분리된 보컬에 RVC 모델을 적용하여 음성 변환한다.

파이프라인:
  1. HuBERT 특징 추출 (transformers HubertModel)
  2. RMVPE 피치 추출
  3. FAISS 인덱스로 유사 특징 검색 (선택적)
  4. SynthesizerTrnMs768NSFsid로 음성 합성
"""

import modal

app = modal.App("vocalmind-ai-cover")

gpu_image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg")
    .pip_install(
        "torch==2.5.1",
        "torchaudio==2.5.1",
        extra_index_url="https://download.pytorch.org/whl/cu121",
    )
    .pip_install(
        "transformers>=4.40.0",
        "librosa>=0.10.0",
        "soundfile>=0.12.0",
        "numpy<2",
        "scipy",
        "faiss-cpu",
        "pedalboard>=0.9",
        "pyloudnorm>=0.1",
    )
    .add_local_python_source("modal_app")
)

model_volume = modal.Volume.from_name("vocalmind-models", create_if_missing=True)

# ──────────────────────────────────────────────
# 상수
# ──────────────────────────────────────────────

HUBERT_SR = 16000
RVC_HOP_LENGTH = 160
RVC_MODELS_DIR = "/models/rvc"
RMVPE_URL = "https://huggingface.co/lj1995/VoiceConversionWebUI/resolve/main/rmvpe.pt"
RMVPE_FILENAME = "rmvpe.pt"


# ──────────────────────────────────────────────
# 유틸리티 함수 (함수 밖에 있어도 OK — 순수 numpy)
# ──────────────────────────────────────────────

def _postprocess_vocal(audio, sr, preset_name="default"):
    """보컬에 프로 후처리 체인 적용 (EQ + 컴프레서 + 리버브 + LUFS 정규화)"""
    import numpy as np
    from pedalboard import (
        Pedalboard, HighpassFilter, PeakFilter, HighShelfFilter,
        Compressor, Reverb, Limiter
    )
    import pyloudnorm as pyln

    PRESETS = {
        "default": {"eq_presence_db": 2.0, "comp_ratio": 3.0, "reverb_room": 0.3, "reverb_wet": 0.15},
        "ballad": {"eq_presence_db": 1.0, "comp_ratio": 2.0, "reverb_room": 0.5, "reverb_wet": 0.20},
        "pop": {"eq_presence_db": 3.0, "comp_ratio": 4.0, "reverb_room": 0.2, "reverb_wet": 0.10},
    }
    p = PRESETS.get(preset_name, PRESETS["default"])

    audio = audio.astype(np.float32)
    if audio.ndim == 1:
        audio = np.stack([audio, audio], axis=0)

    board = Pedalboard([
        HighpassFilter(cutoff_frequency_hz=100.0),
        PeakFilter(cutoff_frequency_hz=300.0, gain_db=-2.0, q=1.0),
        PeakFilter(cutoff_frequency_hz=3000.0, gain_db=p["eq_presence_db"], q=1.0),
        HighShelfFilter(cutoff_frequency_hz=8000.0, gain_db=1.5),
        Compressor(threshold_db=-20.0, ratio=p["comp_ratio"], attack_ms=5.0, release_ms=50.0),
        Reverb(room_size=p["reverb_room"], wet_level=p["reverb_wet"],
               dry_level=1.0 - p["reverb_wet"], damping=0.6),
        Limiter(threshold_db=-1.0),
    ])
    processed = board(audio, sr)

    # LUFS 정규화 (-12 LUFS)
    if processed.ndim == 2 and processed.shape[0] < processed.shape[1]:
        processed = processed.T
    meter = pyln.Meter(sr)
    loudness = meter.integrated_loudness(processed)
    if not (np.isinf(loudness) or np.isnan(loudness)):
        processed = pyln.normalize.loudness(processed, loudness, -12.0)

    # 다시 1D로 (모노 입력이었으면)
    if processed.ndim == 2:
        processed = processed.mean(axis=-1)

    peak = np.max(np.abs(processed))
    if peak > 0.99:
        processed = processed * (0.99 / peak)

    return processed.astype(np.float32)


def _f0_to_coarse(f0):
    """F0(Hz)를 양자화된 피치 인덱스(0~255)로 변환한다."""
    import numpy as np

    f0_mel = 1127 * np.log(1 + f0 / 700)
    f0_mel_min = 1127 * np.log(1 + 50 / 700)
    f0_mel_max = 1127 * np.log(1 + 1100 / 700)

    f0_coarse = (f0_mel - f0_mel_min) / (f0_mel_max - f0_mel_min) * 255
    f0_coarse = np.clip(f0_coarse, 0, 255).astype(np.int64)
    f0_coarse[f0 < 1.0] = 0
    return f0_coarse


def _apply_pitch_shift(f0, semitones: int):
    """F0에 반음 단위 피치 이동을 적용한다."""
    import numpy as np

    factor = 2 ** (semitones / 12.0)
    f0_shifted = f0.copy()
    voiced = f0_shifted > 0
    f0_shifted[voiced] = f0_shifted[voiced] * factor
    return f0_shifted


def _median_filter(f0, radius: int):
    """F0에 중간값 필터를 적용하여 스무딩한다."""
    import numpy as np

    if radius <= 0:
        return f0

    from scipy.signal import medfilt

    f0_filtered = f0.copy()
    voiced = f0_filtered > 0
    if np.any(voiced):
        kernel_size = 2 * radius + 1
        f0_voiced = f0_filtered.copy()
        f0_voiced[~voiced] = np.interp(
            np.where(~voiced)[0],
            np.where(voiced)[0],
            f0_filtered[voiced],
        ) if np.sum(voiced) > 1 else 0

        f0_filtered = medfilt(f0_voiced, kernel_size=kernel_size).astype(np.float32)
        f0_filtered[~voiced] = 0

    return f0_filtered


def _align_features_pitch(feats, f0, f0_coarse):
    """HuBERT 특징과 피치 배열의 길이를 맞춘다."""
    import numpy as np

    feat_len = feats.shape[0]
    if f0 is not None:
        pitch_len = len(f0)
        if pitch_len > feat_len:
            indices = np.linspace(0, pitch_len - 1, feat_len).astype(int)
            f0 = f0[indices]
            f0_coarse = f0_coarse[indices]
        elif pitch_len < feat_len:
            f0 = np.pad(f0, (0, feat_len - pitch_len), mode="edge")
            f0_coarse = np.pad(f0_coarse, (0, feat_len - pitch_len), mode="edge")
    return feats, f0, f0_coarse


# ──────────────────────────────────────────────
# Modal 함수
# ──────────────────────────────────────────────

@app.function(
    image=gpu_image,
    gpu="T4",
    timeout=600,
    volumes={"/models": model_volume},
)
def convert(
    vocals_bytes: bytes,
    model_bytes: bytes,
    index_bytes: bytes | None = None,
    pitch_shift: int = 0,
    index_ratio: float = 0.75,
    filter_radius: int = 3,
    rms_mix_rate: float = 0.25,
    protect: float = 0.33,
    postprocess: bool = True,
    preset_name: str = "default",
) -> bytes:
    """
    RVC v2 음성 변환.

    Args:
        vocals_bytes: 보컬 WAV 바이트
        model_bytes: RVC .pth 모델 바이트
        index_bytes: FAISS .index 바이트 (선택)
        pitch_shift: 피치 변환 (반음 단위)
        index_ratio: 인덱스 혼합 비율
        filter_radius: F0 스무딩 강도
        rms_mix_rate: 볼륨 매칭 비율
        protect: 자음 보호 비율

    Returns:
        변환된 오디오 WAV 바이트
    """
    import io
    import os
    import shutil
    import tempfile
    from pathlib import Path

    import librosa
    import numpy as np
    import soundfile as sf
    import torch
    import torch.nn.functional as F

    from rmvpe import RMVPE
    from rvc_infer_pack.models import (
        SynthesizerTrnMs768NSFsid,
        SynthesizerTrnMs768NSFsid_nono,
    )
    from pretrained_manager import _download_file, RVC_MODELS_DIR as MODELS_DIR_PATH

    device = "cuda" if torch.cuda.is_available() else "cpu"
    is_half = device == "cuda"

    # ── 1) 입력 오디오 로드 ──
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(vocals_bytes)
        vocals_path = f.name

    audio, sr = librosa.load(vocals_path, sr=None, mono=True)
    os.unlink(vocals_path)

    # 16kHz로 리샘플링
    if sr != HUBERT_SR:
        audio_16k = librosa.resample(audio, orig_sr=sr, target_sr=HUBERT_SR)
    else:
        audio_16k = audio

    # 원본 RMS 저장 (나중에 볼륨 매칭용)
    original_rms = np.sqrt(np.mean(audio_16k ** 2) + 1e-8)

    # ── 2) 모델 로드 ──
    with tempfile.NamedTemporaryFile(suffix=".pth", delete=False) as f:
        f.write(model_bytes)
        model_path = f.name

    cpt = torch.load(model_path, map_location="cpu", weights_only=False)
    os.unlink(model_path)

    config_list = cpt.get("config", None)
    if config_list is None:
        raise ValueError("모델 파일에 config 정보가 없습니다.")

    tgt_sr = config_list[-1] if config_list else 40000
    if not isinstance(tgt_sr, int) or tgt_sr < 8000:
        tgt_sr = 40000

    if_f0 = cpt.get("f0", 1)
    version = cpt.get("version", "v1")

    config_keys = [
        "spec_channels", "segment_size", "inter_channels", "hidden_channels",
        "filter_channels", "n_heads", "n_layers", "kernel_size", "p_dropout",
        "resblock", "resblock_kernel_sizes", "resblock_dilation_sizes",
        "upsample_rates", "upsample_initial_channel", "upsample_kernel_sizes",
        "spk_embed_dim", "gin_channels", "sr",
    ]
    config_dict = dict(zip(config_keys, config_list))
    config_dict["is_half"] = False

    if if_f0:
        net_g = SynthesizerTrnMs768NSFsid(**config_dict)
    else:
        net_g = SynthesizerTrnMs768NSFsid_nono(**config_dict)

    state_dict = cpt.get("weight", {})
    new_state_dict = {}
    for k, v in state_dict.items():
        new_key = k[7:] if k.startswith("module.") else k
        new_state_dict[new_key] = v

    net_g.load_state_dict(new_state_dict, strict=False)
    net_g.eval()
    net_g.float()
    net_g.to(device)
    net_g.remove_weight_norm()

    # ── 3) HuBERT 특징 추출 (transformers) ──
    from transformers import HubertModel

    hubert = HubertModel.from_pretrained(
        "facebook/hubert-base-ls960",
        cache_dir=os.path.join(RVC_MODELS_DIR, "hubert_cache"),
    )
    hubert = hubert.to(device)
    if is_half:
        hubert = hubert.half()
    hubert.eval()

    audio_tensor = torch.from_numpy(audio_16k).float().unsqueeze(0).to(device)
    if is_half:
        audio_tensor = audio_tensor.half()

    # 패딩 (HuBERT 최소 길이)
    padding = torch.zeros(1, HUBERT_SR, device=device)
    if is_half:
        padding = padding.half()
    audio_tensor = torch.cat([audio_tensor, padding], dim=1)

    with torch.no_grad():
        outputs = hubert(audio_tensor, output_hidden_states=True)
        feats = outputs.last_hidden_state

    feats = feats.squeeze(0).float().cpu().numpy()

    # ── 4) RMVPE 피치 추출 ──
    rmvpe_path = Path(RVC_MODELS_DIR) / RMVPE_FILENAME
    _download_file(RMVPE_URL, rmvpe_path, "RMVPE 모델 다운로드")

    rmvpe_model = RMVPE(
        model_path=str(rmvpe_path),
        device=device,
        is_half=is_half,
    )
    f0 = rmvpe_model.extract_f0(audio_16k, sr=HUBERT_SR, hop_length=RVC_HOP_LENGTH)

    # 피치 시프트 적용
    if pitch_shift != 0:
        f0 = _apply_pitch_shift(f0, pitch_shift)

    # F0 스무딩
    if filter_radius > 0:
        f0 = _median_filter(f0, filter_radius)

    f0_coarse = _f0_to_coarse(f0)

    # 특징/피치 정렬
    feats, f0, f0_coarse = _align_features_pitch(feats, f0, f0_coarse)

    # ── 5) FAISS 인덱스 검색 (선택적) ──
    if index_bytes and index_ratio > 0:
        try:
            import faiss

            with tempfile.NamedTemporaryFile(suffix=".index", delete=False) as f:
                f.write(index_bytes)
                tmp_idx_path = f.name

            index = faiss.read_index(tmp_idx_path)
            os.unlink(tmp_idx_path)

            if hasattr(index, "nprobe"):
                index.nprobe = 1

            feats_32 = feats.astype(np.float32)
            _, I = index.search(feats_32, k=8)

            npy_results = np.zeros_like(feats_32)
            for i in range(len(feats_32)):
                vecs = []
                for j in range(min(8, I.shape[1])):
                    if I[i][j] >= 0:
                        try:
                            vec = index.reconstruct(int(I[i][j]))
                            vecs.append(vec)
                        except Exception:
                            pass
                if vecs:
                    npy_results[i] = np.mean(vecs, axis=0)
                else:
                    npy_results[i] = feats_32[i]

            feats = feats * (1 - index_ratio) + npy_results * index_ratio
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("인덱스 검색 실패: %s", e)

    # ── 6) RVC 합성 ──
    T = feats.shape[0]
    phone_t = torch.from_numpy(feats).float().unsqueeze(0).to(device)
    p_len = torch.tensor([T], dtype=torch.long, device=device)
    sid = torch.tensor([0], dtype=torch.long, device=device)

    if if_f0:
        f0c_t = torch.from_numpy(f0_coarse).long().unsqueeze(0).to(device)
        f0_t = torch.from_numpy(f0.astype(np.float32)).float().unsqueeze(0).to(device)

        with torch.no_grad():
            o = net_g.infer(phone_t, p_len, f0c_t, f0_t, sid)
    else:
        with torch.no_grad():
            o = net_g.infer(phone_t, p_len, sid)

    output_audio = o.squeeze().float().cpu().numpy()

    # ── 7) 볼륨 매칭 ──
    if rms_mix_rate > 0:
        output_rms = np.sqrt(np.mean(output_audio ** 2) + 1e-8)
        if output_rms > 1e-6:
            gain = original_rms / output_rms
            gain = 1.0 + (gain - 1.0) * rms_mix_rate
            output_audio = output_audio * gain

    # 클리핑 방지
    peak = np.abs(output_audio).max()
    if peak > 1.0:
        output_audio = output_audio / peak * 0.95

    # ── 7.5) 후처리 (EQ + 컴프레서 + 리버브 + LUFS) ──
    if postprocess:
        output_audio = _postprocess_vocal(output_audio, tgt_sr, preset_name)

    # ── 8) WAV 바이트로 출력 ──
    buf = io.BytesIO()
    sf.write(buf, output_audio, tgt_sr, format="WAV", subtype="PCM_16")

    # GPU 메모리 해제
    del net_g, hubert, rmvpe_model
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    return buf.getvalue()
