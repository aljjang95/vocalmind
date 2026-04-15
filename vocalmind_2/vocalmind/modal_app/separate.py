import io

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
        "demucs==4.0.1",
        "numpy<2",
        "soundfile>=0.12.0",
    )
)

model_volume = modal.Volume.from_name("vocalmind-models", create_if_missing=True)


@app.function(
    image=gpu_image,
    gpu="T4",
    timeout=300,
    volumes={"/models": model_volume},
)
def separate(audio_bytes: bytes) -> dict[str, bytes]:
    """오디오에서 보컬과 반주를 분리한다."""
    import tempfile

    import numpy as np
    import soundfile as sf
    import torch
    import torchaudio
    from demucs.apply import apply_model
    from demucs.pretrained import get_model

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_bytes)
        input_path = f.name

    model = get_model("htdemucs")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)

    wav, sr = torchaudio.load(input_path)
    model_sr = model.samplerate
    if sr != model_sr:
        wav = torchaudio.transforms.Resample(sr, model_sr)(wav)

    # 모노 → 스테레오 (htdemucs는 2채널 필요)
    if wav.shape[0] == 1:
        wav = wav.expand(2, -1)

    wav = wav.unsqueeze(0).to(device)

    with torch.no_grad():
        sources = apply_model(model, wav, device=device, num_workers=0)

    source_names = model.sources
    vocals_idx = source_names.index("vocals")

    vocals = sources[0, vocals_idx].cpu().numpy()
    instrumental_indices = [i for i in range(len(source_names)) if i != vocals_idx]
    instrumental = sum(sources[0, i] for i in instrumental_indices).cpu().numpy()

    vocals_buf = io.BytesIO()
    sf.write(vocals_buf, vocals.T, model_sr, format="WAV", subtype="PCM_16")

    inst_buf = io.BytesIO()
    sf.write(inst_buf, instrumental.T, model_sr, format="WAV", subtype="PCM_16")

    return {
        "vocals": vocals_buf.getvalue(),
        "instrumental": inst_buf.getvalue(),
    }
