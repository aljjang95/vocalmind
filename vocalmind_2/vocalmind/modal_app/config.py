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
        "transformers>=4.40.0",
        "librosa>=0.10.0",
        "soundfile>=0.12.0",
        "numpy<2",
        "scipy",
        "faiss-cpu",
        "pyworld",
        "praat-parselmouth",
        "pedalboard>=0.9",
        "pyloudnorm>=0.1",
    )
)

model_volume = modal.Volume.from_name("vocalmind-models", create_if_missing=True)
