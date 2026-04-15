"""
VocalMind Modal - RVC v2 모델 학습
녹음 파일들로 RVC v2 모델을 파인튜닝한다.

파이프라인:
  1. 오디오 전처리 (리샘플링, 정규화, 무음 제거)
  2. HuBERT 특징 추출
  3. 피치 추출 (RMVPE)
  4. 스펙트로그램 계산 (40kHz)
  5. GAN 파인튜닝 (Generator + Discriminator)
  6. FAISS 인덱스 생성
  7. 모델 저장
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
        "pyworld",
        "praat-parselmouth",
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

TRAIN_TARGET_SR = 40000
TRAIN_N_FFT = 2048
TRAIN_HOP_SIZE = 400
TRAIN_WIN_SIZE = 1600


# ──────────────────────────────────────────────
# GAN 학습용 손실 함수
# ──────────────────────────────────────────────

def _discriminator_loss(disc_real_outputs, disc_generated_outputs):
    """Discriminator LSGAN 손실."""
    import torch
    loss = torch.tensor(0.0)
    for dr, dg in zip(disc_real_outputs, disc_generated_outputs):
        r_loss = torch.mean((1 - dr) ** 2)
        g_loss = torch.mean(dg ** 2)
        loss = loss + r_loss + g_loss
    return loss


def _generator_adv_loss(disc_outputs):
    """Generator LSGAN 적대적 손실."""
    import torch
    loss = torch.tensor(0.0)
    for dg in disc_outputs:
        loss = loss + torch.mean((1 - dg) ** 2)
    return loss


def _feature_matching_loss(fmap_r, fmap_g):
    """Feature matching 손실."""
    import torch
    loss = torch.tensor(0.0)
    for dr, dg in zip(fmap_r, fmap_g):
        for rl, gl in zip(dr, dg):
            loss = loss + torch.mean(torch.abs(rl.detach() - gl))
    return loss


def _kl_loss(z_p, logs_q, m_p, logs_p, z_mask):
    """KL divergence 손실."""
    import torch
    min_len = min(z_p.size(2), m_p.size(2))
    z_p = z_p[:, :, :min_len]
    logs_q = logs_q[:, :, :min_len]
    m_p = m_p[:, :, :min_len]
    logs_p = logs_p[:, :, :min_len]
    z_mask = z_mask[:, :, :min_len]

    kl = logs_p - logs_q - 0.5 + 0.5 * ((z_p - m_p) ** 2) * torch.exp(-2.0 * logs_p)
    kl = torch.sum(kl * z_mask) / torch.sum(z_mask)
    return kl


# ──────────────────────────────────────────────
# 유틸리티 함수
# ──────────────────────────────────────────────

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


def _compute_spectrogram(audio_16k, device, target_sr=TRAIN_TARGET_SR):
    """16kHz 오디오를 target_sr로 리샘플링한 뒤 스펙트로그램을 계산한다."""
    import torch
    import torch.nn.functional as F
    import torchaudio
    import numpy as np

    audio_tensor = torch.from_numpy(audio_16k).float()
    if target_sr != 16000:
        resampler = torchaudio.transforms.Resample(16000, target_sr)
        audio_tensor = resampler(audio_tensor)

    hann_window = torch.hann_window(TRAIN_WIN_SIZE).to(device)
    audio_on_device = audio_tensor.to(device)

    pad_amount = (TRAIN_N_FFT - TRAIN_HOP_SIZE) // 2
    audio_padded = F.pad(audio_on_device.unsqueeze(0),
                         (pad_amount, pad_amount), mode="reflect").squeeze(0)

    spec_complex = torch.stft(
        audio_padded, TRAIN_N_FFT,
        hop_length=TRAIN_HOP_SIZE,
        win_length=TRAIN_WIN_SIZE,
        window=hann_window,
        return_complex=True,
    )
    spec = torch.sqrt(spec_complex.real.pow(2) + spec_complex.imag.pow(2) + 1e-6)
    return spec, audio_on_device


def _spec_to_mel(spec, sr=TRAIN_TARGET_SR, n_fft=TRAIN_N_FFT, n_mels=128):
    """선형 스펙트로그램을 mel 스펙트로그램으로 변환한다."""
    import torch
    import torchaudio
    mel_basis = torchaudio.functional.melscale_fbanks(
        n_freqs=n_fft // 2 + 1,
        f_min=0.0,
        f_max=sr / 2.0,
        n_mels=n_mels,
        sample_rate=sr,
    ).to(spec.device)
    mel = torch.matmul(mel_basis.T, spec)
    mel = torch.log(torch.clamp(mel, min=1e-5))
    return mel


def _audio_to_mel(audio, device, sr=TRAIN_TARGET_SR):
    """오디오 텐서에서 mel spectrogram을 계산한다."""
    import torch
    import torch.nn.functional as F

    if audio.dim() == 3:
        audio = audio.squeeze(1)
    if audio.dim() == 1:
        audio = audio.unsqueeze(0)

    hann_window = torch.hann_window(TRAIN_WIN_SIZE).to(device)
    pad_amount = (TRAIN_N_FFT - TRAIN_HOP_SIZE) // 2

    mels = []
    for i in range(audio.size(0)):
        a = F.pad(audio[i].unsqueeze(0), (pad_amount, pad_amount), mode="reflect").squeeze(0)
        spec_complex = torch.stft(
            a, TRAIN_N_FFT,
            hop_length=TRAIN_HOP_SIZE,
            win_length=TRAIN_WIN_SIZE,
            window=hann_window,
            return_complex=True,
        )
        spec_mag = torch.sqrt(spec_complex.real.pow(2) + spec_complex.imag.pow(2) + 1e-6)
        mel = _spec_to_mel(spec_mag, sr=sr, n_fft=TRAIN_N_FFT)
        mels.append(mel)
    return torch.stack(mels, dim=0)


def _get_default_model_config(sr: int = 40000) -> dict:
    """RVC v2 기본 모델 설정을 반환한다."""
    return {
        "spec_channels": 1025,
        "segment_size": 32,
        "inter_channels": 192,
        "hidden_channels": 192,
        "filter_channels": 768,
        "n_heads": 2,
        "n_layers": 6,
        "kernel_size": 3,
        "p_dropout": 0.0,
        "resblock": "1",
        "resblock_kernel_sizes": [3, 7, 11],
        "resblock_dilation_sizes": [[1, 3, 5], [1, 3, 5], [1, 3, 5]],
        "upsample_rates": [10, 10, 2, 2],
        "upsample_initial_channel": 512,
        "upsample_kernel_sizes": [16, 16, 4, 4],
        "spk_embed_dim": 109,
        "gin_channels": 256,
        "sr": sr,
        "is_half": False,
    }


def _save_rvc_model(net_g, config_params, output_path, tgt_sr=40000):
    """RVC 모델을 .pth 파일로 저장한다."""
    import torch
    from pathlib import Path

    config_list = [
        config_params["spec_channels"],
        config_params["segment_size"],
        config_params["inter_channels"],
        config_params["hidden_channels"],
        config_params["filter_channels"],
        config_params["n_heads"],
        config_params["n_layers"],
        config_params["kernel_size"],
        config_params["p_dropout"],
        config_params["resblock"],
        config_params["resblock_kernel_sizes"],
        config_params["resblock_dilation_sizes"],
        config_params["upsample_rates"],
        config_params["upsample_initial_channel"],
        config_params["upsample_kernel_sizes"],
        config_params["spk_embed_dim"],
        config_params["gin_channels"],
        tgt_sr,
    ]

    state_dict = {}
    for k, v in net_g.state_dict().items():
        if v.dtype == torch.float32:
            state_dict[k] = v.half().cpu()
        else:
            state_dict[k] = v.cpu()

    torch.save(
        {
            "weight": state_dict,
            "config": config_list,
            "f0": 1,
            "version": "v2",
            "sr": tgt_sr,
            "info": "VocalMind Modal에서 학습됨",
        },
        str(output_path),
    )


def _preprocess_training_audio(recording_bytes_list: list[bytes]) -> list:
    """
    학습용 오디오 전처리: 리샘플링, 정규화, 무음 제거, 세그먼트 분할.

    Returns:
        전처리된 오디오 세그먼트 리스트 (각 16kHz, float32)
    """
    import io
    import logging

    import librosa
    import numpy as np
    import soundfile as sf

    logger = logging.getLogger(__name__)
    segments = []
    segment_length = HUBERT_SR * 5  # 5초 세그먼트

    for idx, audio_bytes in enumerate(recording_bytes_list):
        try:
            buf = io.BytesIO(audio_bytes)
            audio, sr = sf.read(buf)
            if audio.ndim > 1:
                audio = audio.mean(axis=1)
            audio = audio.astype(np.float32)

            # 16kHz로 리샘플링
            if sr != HUBERT_SR:
                audio = librosa.resample(audio, orig_sr=sr, target_sr=HUBERT_SR)

            # 정규화
            peak = np.abs(audio).max()
            if peak > 0:
                audio = audio / peak * 0.95

            # 무음 구간 제거
            intervals = librosa.effects.split(audio, top_db=30, hop_length=512)
            voiced_parts = []
            for start, end in intervals:
                if (end - start) > HUBERT_SR * 0.3:
                    voiced_parts.append(audio[start:end])

            if not voiced_parts:
                voiced_parts = [audio]

            full_audio = np.concatenate(voiced_parts)

            # 세그먼트 분할
            for start in range(0, len(full_audio) - HUBERT_SR, segment_length):
                end = min(start + segment_length, len(full_audio))
                seg = full_audio[start:end]
                if len(seg) >= HUBERT_SR:
                    segments.append(seg)

            if not segments:
                if len(full_audio) >= HUBERT_SR * 0.5:
                    segments.append(full_audio)

        except Exception as e:
            logger.warning("오디오 전처리 실패 (인덱스 %d): %s", idx, e)
            continue

    return segments


def _build_faiss_index(features, output_path: str):
    """HuBERT 특징으로 FAISS 인덱스를 생성한다."""
    import logging
    import shutil
    import tempfile
    from pathlib import Path

    import faiss
    import numpy as np

    logger = logging.getLogger(__name__)

    features = features.astype(np.float32)
    dim = features.shape[1]
    n_samples = features.shape[0]

    if n_samples < 256:
        index = faiss.IndexFlatL2(dim)
    else:
        n_clusters = min(int(n_samples ** 0.5), 256)
        quantizer = faiss.IndexFlatL2(dim)
        index = faiss.IndexIVFFlat(quantizer, dim, n_clusters)
        index.train(features)

    index.add(features)

    # 임시 파일에 쓰고 이동 (한글 경로 문제 우회)
    tmp_path = tempfile.mktemp(suffix=".index")
    faiss.write_index(index, tmp_path)
    shutil.move(tmp_path, output_path)
    logger.info("FAISS 인덱스 생성: %d 벡터, dim=%d", n_samples, dim)


# ──────────────────────────────────────────────
# Modal 함수
# ──────────────────────────────────────────────

@app.function(
    image=gpu_image,
    gpu="T4",
    timeout=3600,
    volumes={"/models": model_volume},
)
def train(
    recording_bytes_list: list[bytes],
    model_name: str = "user_model",
    epochs: int = 200,
    batch_size: int = 4,
    learning_rate: float = 1e-4,
) -> dict[str, bytes]:
    """
    RVC v2 모델 학습 (파인튜닝).

    Args:
        recording_bytes_list: 학습 녹음 WAV 바이트 리스트
        model_name: 모델 이름
        epochs: 학습 에포크 수
        batch_size: 배치 크기
        learning_rate: 학습률

    Returns:
        {"model": .pth 바이트, "index": .index 바이트, "loss_history": JSON 문자열}
    """
    import io
    import json
    import logging
    import math
    import os
    import tempfile
    from pathlib import Path

    import librosa
    import numpy as np
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    from rmvpe import RMVPE
    from rvc_infer_pack.models import (
        SynthesizerTrnMs768NSFsid,
        MultiPeriodDiscriminatorV2,
    )
    from pretrained_manager import (
        _download_file,
        ensure_pretrained_models,
        get_pretrained_g_path,
        get_pretrained_d_path,
    )

    logger = logging.getLogger(__name__)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    is_half = device == "cuda"

    # ── 1) 오디오 전처리 ──
    logger.info("오디오 전처리 중...")
    processed_audios = _preprocess_training_audio(recording_bytes_list)
    if not processed_audios:
        raise ValueError("유효한 학습 오디오가 없습니다.")
    logger.info("전처리된 오디오 %d개", len(processed_audios))

    # ── 2) HuBERT 특징 추출 ──
    logger.info("HuBERT 특징 추출 중...")
    from transformers import HubertModel

    hubert = HubertModel.from_pretrained(
        "facebook/hubert-base-ls960",
        cache_dir=os.path.join(RVC_MODELS_DIR, "hubert_cache"),
    )
    hubert = hubert.to(device)
    if is_half:
        hubert = hubert.half()
    hubert.eval()

    all_features = []
    all_f0 = []
    all_f0_coarse = []

    # RMVPE 로드
    rmvpe_path = Path(RVC_MODELS_DIR) / RMVPE_FILENAME
    _download_file(RMVPE_URL, rmvpe_path, "RMVPE 모델 다운로드")
    rmvpe_model = RMVPE(model_path=str(rmvpe_path), device=device, is_half=is_half)

    for i, audio in enumerate(processed_audios):
        # HuBERT 특징
        audio_tensor = torch.from_numpy(audio).float().unsqueeze(0).to(device)
        if is_half:
            audio_tensor = audio_tensor.half()

        padding = torch.zeros(1, HUBERT_SR, device=device)
        if is_half:
            padding = padding.half()
        audio_tensor = torch.cat([audio_tensor, padding], dim=1)

        with torch.no_grad():
            outputs = hubert(audio_tensor, output_hidden_states=True)
            feats = outputs.last_hidden_state

        feats = feats.squeeze(0).float().cpu().numpy()

        # F0 피치 추출
        f0 = rmvpe_model.extract_f0(audio, sr=HUBERT_SR, hop_length=RVC_HOP_LENGTH)
        f0_coarse = _f0_to_coarse(f0)

        feats, f0, f0_coarse = _align_features_pitch(feats, f0, f0_coarse)

        all_features.append(feats)
        all_f0.append(f0)
        all_f0_coarse.append(f0_coarse)

    features_concat = np.concatenate(all_features, axis=0)

    # HuBERT/RMVPE 메모리 해제
    del hubert, rmvpe_model
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    # ── 3) 스펙트로그램 계산 ──
    logger.info("스펙트로그램 계산 중...")
    all_specs = []
    all_audio_40k = []

    for audio_16k in processed_audios:
        spec, audio_40k = _compute_spectrogram(audio_16k, device, target_sr=TRAIN_TARGET_SR)
        all_specs.append(spec)
        all_audio_40k.append(audio_40k)

    # ── 4) 사전학습 모델 로드 ──
    logger.info("사전학습 모델 로드 중...")
    ensure_pretrained_models()

    config_params = _get_default_model_config(sr=TRAIN_TARGET_SR)
    segment_size = config_params["segment_size"]
    hop_size = TRAIN_HOP_SIZE

    # Generator
    net_g = SynthesizerTrnMs768NSFsid(**config_params)
    net_g.to(device)
    pretrained_g_path = get_pretrained_g_path(sr=TRAIN_TARGET_SR)
    if pretrained_g_path.exists():
        g_state = torch.load(str(pretrained_g_path), map_location=device)
        if "model" in g_state:
            g_state = g_state["model"]
        net_g.load_state_dict(g_state, strict=False)
        logger.info("Generator 사전학습 가중치 로드 완료")

    # Discriminator
    net_d = MultiPeriodDiscriminatorV2()
    net_d.to(device)
    pretrained_d_path = get_pretrained_d_path(sr=TRAIN_TARGET_SR)
    if pretrained_d_path.exists():
        d_state = torch.load(str(pretrained_d_path), map_location=device)
        if "model" in d_state:
            d_state = d_state["model"]
        net_d.load_state_dict(d_state, strict=False)
        logger.info("Discriminator 사전학습 가중치 로드 완료")

    net_g.train()
    net_d.train()

    # Optimizer
    optim_g = torch.optim.AdamW(
        net_g.parameters(), lr=learning_rate, betas=(0.8, 0.99), eps=1e-9,
    )
    optim_d = torch.optim.AdamW(
        net_d.parameters(), lr=learning_rate, betas=(0.8, 0.99), eps=1e-9,
    )
    sched_g = torch.optim.lr_scheduler.ExponentialLR(optim_g, gamma=0.999)
    sched_d = torch.optim.lr_scheduler.ExponentialLR(optim_d, gamma=0.999)

    # 유효 세그먼트 필터링
    valid_indices = [
        idx for idx in range(len(all_specs))
        if all_specs[idx].size(-1) >= segment_size
    ]
    if not valid_indices:
        raise ValueError(
            f"모든 세그먼트의 스펙트로그램 길이가 segment_size({segment_size}) 미만입니다. "
            "더 긴 오디오를 사용하세요."
        )
    while len(valid_indices) < 3:
        valid_indices = valid_indices * 2
    valid_indices = valid_indices[:max(len(valid_indices), 3)]
    logger.info("GAN 학습에 사용할 유효 세그먼트: %d개", len(valid_indices))

    # ── 5) GAN 학습 루프 ──
    logger.info("GAN 학습 시작 (에포크: %d)...", epochs)
    upsample_rate = math.prod(config_params["upsample_rates"])
    loss_history = []

    for epoch in range(epochs):
        epoch_loss_d = 0.0
        epoch_loss_g = 0.0
        num_steps = 0

        for seg_idx in valid_indices:
            feats = all_features[seg_idx]
            f0_np = all_f0[seg_idx]
            f0c_np = all_f0_coarse[seg_idx]
            spec = all_specs[seg_idx]
            audio_40k = all_audio_40k[seg_idx]

            T_feats = feats.shape[0]
            T_spec = spec.size(-1)
            phone_t = torch.from_numpy(feats).float().unsqueeze(0).to(device)
            f0c_t = torch.from_numpy(f0c_np).long().unsqueeze(0).to(device)
            p_len = torch.tensor([T_feats], dtype=torch.long, device=device)
            spec_t = spec.unsqueeze(0).to(device)
            spec_len = torch.tensor([T_spec], dtype=torch.long, device=device)
            sid = torch.tensor([0], dtype=torch.long, device=device)
            audio_40k_t = audio_40k.unsqueeze(0).to(device)

            # pitchf 보간
            f0_spec = np.interp(
                np.linspace(0, len(f0_np) - 1, T_spec),
                np.arange(len(f0_np)),
                f0_np,
            ).astype(np.float32)
            f0_t = torch.from_numpy(f0_spec).float().unsqueeze(0).to(device)

            # Generator forward
            (y_hat, ids_slice, x_mask, z_mask,
             (z, z_p, m_p, logs_p, m_q, logs_q)) = net_g.forward(
                phone_t, p_len, f0c_t, f0_t, spec_t, spec_len, sid
            )

            # GT 오디오 슬라이스
            gen_audio_len = y_hat.size(-1)
            y_gt_slices = []
            for b_idx in range(ids_slice.size(0)):
                start_frame = ids_slice[b_idx].item()
                start_sample = start_frame * hop_size
                end_sample = start_sample + gen_audio_len
                gt_slice = audio_40k_t[b_idx, start_sample:end_sample]
                if gt_slice.size(0) < gen_audio_len:
                    gt_slice = F.pad(gt_slice, (0, gen_audio_len - gt_slice.size(0)))
                y_gt_slices.append(gt_slice)
            y_gt = torch.stack(y_gt_slices, dim=0).unsqueeze(1)

            # D step
            optim_d.zero_grad()
            y_d_rs, y_d_gs, _, _ = net_d(y_gt, y_hat.detach())
            loss_d = _discriminator_loss(y_d_rs, y_d_gs)
            loss_d.backward()
            optim_d.step()

            # G step
            optim_g.zero_grad()
            y_d_rs, y_d_gs, fmap_rs, fmap_gs = net_d(y_gt, y_hat)

            mel_hat = _audio_to_mel(y_hat, device, sr=TRAIN_TARGET_SR)
            mel_gt = _audio_to_mel(y_gt, device, sr=TRAIN_TARGET_SR)
            loss_mel = F.l1_loss(mel_hat, mel_gt)

            loss_kl = _kl_loss(z_p, logs_q, m_p, logs_p, z_mask)
            loss_fm = _feature_matching_loss(fmap_rs, fmap_gs)
            loss_adv = _generator_adv_loss(y_d_gs)

            loss_g = loss_mel * 45.0 + loss_kl * 1.0 + loss_fm * 2.0 + loss_adv

            loss_g.backward()
            torch.nn.utils.clip_grad_norm_(net_g.parameters(), max_norm=1.0)
            optim_g.step()

            epoch_loss_d += loss_d.item()
            epoch_loss_g += loss_g.item()
            num_steps += 1

        sched_g.step()
        sched_d.step()

        avg_d = epoch_loss_d / max(num_steps, 1)
        avg_g = epoch_loss_g / max(num_steps, 1)

        loss_entry = {
            "epoch": epoch + 1,
            "g_total": round(avg_g, 4),
            "d_total": round(avg_d, 4),
            "mel": round(loss_mel.item() * 45.0, 4),
            "kl": round(loss_kl.item(), 4),
            "fm": round(loss_fm.item() * 2.0, 4),
            "adv": round(loss_adv.item(), 4),
        }
        loss_history.append(loss_entry)

        if epoch % 10 == 0 or epoch == epochs - 1:
            logger.info(
                "에포크 %d/%d - G: %.4f, D: %.4f",
                epoch + 1, epochs, avg_g, avg_d,
            )

    # ── 6) FAISS 인덱스 생성 ──
    logger.info("FAISS 인덱스 생성 중...")
    index_tmp = tempfile.mktemp(suffix=".index")
    _build_faiss_index(features_concat, index_tmp)

    # ── 7) 모델 저장 ──
    logger.info("모델 저장 중...")
    model_tmp = tempfile.mktemp(suffix=".pth")
    _save_rvc_model(net_g, config_params, model_tmp, tgt_sr=TRAIN_TARGET_SR)

    # 바이트로 읽기
    with open(model_tmp, "rb") as f:
        model_bytes = f.read()
    with open(index_tmp, "rb") as f:
        index_bytes = f.read()

    # 정리
    os.unlink(model_tmp)
    os.unlink(index_tmp)

    del net_g, net_d, optim_g, optim_d
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    logger.info("학습 완료: 모델 %d bytes, 인덱스 %d bytes", len(model_bytes), len(index_bytes))

    return {
        "model": model_bytes,
        "index": index_bytes,
        "loss_history": json.dumps(loss_history, ensure_ascii=False),
    }
