"""
Modal Demucs — 보컬/반주 분리 서버리스 GPU 함수 (Phase 0 callback 패턴)

동작:
1. fastapi_endpoint가 JSON {job_id, audio_url, callback_url, step, output_bucket, output_prefix} 수신
2. _process_demucs를 .spawn()으로 비동기 시작 → 즉시 {accepted: True} 반환
3. _process_demucs가 audio 다운로드 → Demucs 분리 → Supabase Storage 업로드
4. POST callback_url with X-Orchestrator-Secret 헤더

T4 GPU, htdemucs 모델, ~30초/곡
배포: PYTHONIOENCODING=utf-8 modal deploy modal_demucs.py
필요 Secrets: vocalmind-supabase(SUPABASE_URL/SERVICE_ROLE_KEY), vocalmind-orchestrator(ORCHESTRATOR_SECRET)
"""

import modal

app = modal.App("vocalmind-demucs")

demucs_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "torch>=2.0.0",
        "torchaudio>=2.0.0",
        "demucs>=4.0.0",
        "soundfile>=0.12.0",
        "numpy>=1.26.0",
        "httpx>=0.27.0",
        "supabase>=2.7.0",
        "fastapi[standard]",
    )
    .run_commands("python -c \"from demucs.pretrained import get_model; get_model('htdemucs')\"")
)

SECRETS = [
    modal.Secret.from_name("vocalmind-supabase"),
    modal.Secret.from_name("vocalmind-orchestrator"),
]


# ── 워커: 실제 분리 처리 (spawn으로 비동기 실행) ─────────────────────

@app.function(
    image=demucs_image,
    gpu="T4",
    timeout=600,
    scaledown_window=60,
    secrets=SECRETS,
)
def _process_demucs(
    job_id: str,
    audio_url: str,
    callback_url: str,
    step: str,
    output_bucket: str,
    output_prefix: str,
) -> None:
    """Demucs 분리 → Supabase Storage 업로드 → callback POST."""
    import os
    import tempfile
    import traceback
    from pathlib import Path

    import httpx
    import soundfile as sf
    import torch
    import torchaudio

    work = Path(tempfile.mkdtemp())
    try:
        # 1) 오디오 다운로드
        in_path = work / "input.wav"
        with httpx.Client(timeout=60.0) as client:
            with client.stream("GET", audio_url) as r:
                r.raise_for_status()
                with open(in_path, "wb") as f:
                    for chunk in r.iter_bytes():
                        f.write(chunk)

        # 2) 모델 로드 + 분리
        from demucs.pretrained import get_model
        from demucs.apply import apply_model, BagOfModels

        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = get_model("htdemucs")
        if isinstance(model, BagOfModels):
            for m in model.models:
                m.to(device)
        else:
            model.to(device)

        wav, sr = torchaudio.load(str(in_path))
        model_sr = model.samplerate
        if sr != model_sr:
            wav = torchaudio.transforms.Resample(sr, model_sr)(wav)
        if wav.shape[0] == 1:
            wav = wav.expand(2, -1)
        wav = wav.unsqueeze(0).to(device)

        with torch.no_grad():
            sources = apply_model(model, wav, device=device, progress=False, num_workers=0)

        source_names = model.sources
        vocals_idx = source_names.index("vocals")
        vocals = sources[0, vocals_idx].cpu().numpy()
        instr = sum(
            sources[0, i] for i in range(len(source_names)) if i != vocals_idx
        ).cpu().numpy()

        vocals_path = work / "vocals.wav"
        instr_path = work / "instrumental.wav"
        sf.write(str(vocals_path), vocals.T, model_sr, subtype="PCM_16")
        sf.write(str(instr_path), instr.T, model_sr, subtype="PCM_16")

        # 3) Supabase Storage 업로드
        from supabase import create_client
        sb = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )

        vocals_key = f"{output_prefix}/vocals.wav"
        instr_key = f"{output_prefix}/instrumental.wav"

        sb.storage.from_(output_bucket).upload(
            vocals_key, vocals_path.read_bytes(),
            file_options={"content-type": "audio/wav", "upsert": "true"},
        )
        sb.storage.from_(output_bucket).upload(
            instr_key, instr_path.read_bytes(),
            file_options={"content-type": "audio/wav", "upsert": "true"},
        )

        _post_callback(callback_url, {
            "job_id": job_id,
            "step": step,
            "status": "success",
            "result": {
                "vocals_path": f"{output_bucket}/{vocals_key}",
                "instrumental_path": f"{output_bucket}/{instr_key}",
            },
        })

    except Exception as e:
        _post_callback(callback_url, {
            "job_id": job_id,
            "step": step,
            "status": "failed",
            "error": f"{type(e).__name__}: {e}",
            "result": {"traceback": traceback.format_exc()[:2000]},
        })
    finally:
        # 임시 파일 정리
        for p in work.glob("*"):
            try:
                p.unlink()
            except OSError:
                pass
        try:
            work.rmdir()
        except OSError:
            pass


# ── HTTP 엔드포인트: spawn + 즉시 응답 ───────────────────────────────

@app.function(
    image=demucs_image,
    cpu=0.5,
    memory=512,
    timeout=30,
    secrets=SECRETS,
)
@modal.fastapi_endpoint(method="POST")
async def separate(request):
    """POST JSON {job_id, audio_url, callback_url, step, output_bucket, output_prefix}."""
    body = await request.json()

    required = ["job_id", "audio_url", "callback_url", "step", "output_bucket", "output_prefix"]
    missing = [k for k in required if not body.get(k)]
    if missing:
        return {"error": f"필수 필드 누락: {missing}", "code": "MISSING_FIELDS"}

    _process_demucs.spawn(
        body["job_id"],
        body["audio_url"],
        body["callback_url"],
        body["step"],
        body["output_bucket"],
        body["output_prefix"],
    )

    return {"accepted": True, "job_id": body["job_id"]}


# ── 헬퍼 ──────────────────────────────────────────────────────────

def _post_callback(url: str, payload: dict) -> None:
    """orchestrator에 콜백 POST. 실패 시 로그만 (orchestrator timeout 폴백)."""
    import os
    import httpx
    secret = os.environ.get("ORCHESTRATOR_SECRET", "")
    try:
        httpx.post(
            url,
            json=payload,
            headers={"X-Orchestrator-Secret": secret, "Content-Type": "application/json"},
            timeout=20.0,
        )
    except httpx.HTTPError as e:
        print(f"[demucs] callback 실패 job_id={payload.get('job_id')}: {e}")
