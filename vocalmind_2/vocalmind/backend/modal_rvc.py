"""
Modal RVC — AI 커버 음성 변환 서버리스 GPU 함수
T4 GPU, RVC v2 + Demucs 분리 통합, ~60초/곡
배포: PYTHONIOENCODING=utf-8 modal deploy modal_rvc.py

환경변수 (Modal Secret 'vocalmind-supabase'):
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import modal

app = modal.App("vocalmind-rvc")

# ── 이미지: RVC + Demucs 통합 ──
rvc_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1", "sox")
    # 1단계: 핵심 의존성 (최신 버전)
    .pip_install(
        "torch>=2.0.0",
        "torchaudio>=2.0.0",
        "demucs>=4.0.0",
        "soundfile>=0.12.0",
        "numpy>=1.26.0",
        "scipy>=1.12.0",
        "httpx>=0.27.0",
        "fastapi[standard]",
        "faiss-cpu>=1.7.0",
        "praat-parselmouth>=0.4.0",
        "librosa>=0.10.0",
    )
    # 2단계: rvc-python --no-deps (numpy<=1.23 제약 우회)
    .run_commands("pip install rvc-python --no-deps")
    # 3단계: rvc-python의 실제 필요 의존성 (fairseq 등)
    .run_commands("pip install fairseq==0.12.2 --no-deps || true")
    .run_commands("pip install bitarray hydra-core omegaconf regex sacrebleu portalocker || true")
    # Demucs + RVC 모델 프리로드
    .run_commands("python -c \"from demucs.pretrained import get_model; get_model('htdemucs')\"")
)

# Supabase 시크릿 (Modal Dashboard에서 설정)
supabase_secret = modal.Secret.from_name("vocalmind-supabase", required_keys=["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])


# ── 헬퍼: Supabase Storage/DB 접근 ──
class SupabaseClient:
    """Modal 함수 내에서 Supabase REST API 호출"""

    def __init__(self):
        import os
        self.url = os.environ["SUPABASE_URL"]
        self.key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
        }

    def download_storage(self, bucket: str, path: str, local_path: str):
        """Supabase Storage에서 파일 다운로드"""
        import httpx
        url = f"{self.url}/storage/v1/object/{bucket}/{path}"
        resp = httpx.get(url, headers=self.headers, timeout=120, follow_redirects=True)
        resp.raise_for_status()
        with open(local_path, "wb") as f:
            f.write(resp.content)

    def upload_storage(self, bucket: str, path: str, local_path: str, content_type: str = "audio/wav"):
        """Supabase Storage에 파일 업로드"""
        import httpx
        url = f"{self.url}/storage/v1/object/{bucket}/{path}"
        with open(local_path, "rb") as f:
            data = f.read()
        resp = httpx.post(
            url,
            headers={**self.headers, "Content-Type": content_type},
            content=data,
            timeout=120,
        )
        # 이미 존재하면 upsert
        if resp.status_code == 409:
            resp = httpx.put(
                url,
                headers={**self.headers, "Content-Type": content_type},
                content=data,
                timeout=120,
            )
        resp.raise_for_status()

    def update_record(self, table: str, record_id: str, data: dict):
        """Supabase DB 레코드 업데이트"""
        import httpx
        url = f"{self.url}/rest/v1/{table}?id=eq.{record_id}"
        resp = httpx.patch(
            url,
            headers={**self.headers, "Content-Type": "application/json", "Prefer": "return=minimal"},
            json=data,
            timeout=30,
        )
        resp.raise_for_status()


# ── Demucs 분리 (내장) ──
def separate_vocals(input_path: str, work_dir: str) -> tuple[str, str]:
    """Demucs로 보컬/반주 분리 → (vocals_path, instrumental_path) 반환"""
    from pathlib import Path
    import torch
    import torchaudio
    import soundfile as sf
    from demucs.pretrained import get_model
    from demucs.apply import apply_model, BagOfModels

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = get_model("htdemucs")

    if isinstance(model, BagOfModels):
        for m in model.models:
            m.to(device)
    else:
        model.to(device)

    wav, sr = torchaudio.load(input_path)
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
    instrumental_indices = [i for i in range(len(source_names)) if i != vocals_idx]
    instrumental = sum(sources[0, i] for i in instrumental_indices).cpu().numpy()

    vocals_path = str(Path(work_dir) / "vocals.wav")
    instrumental_path = str(Path(work_dir) / "instrumental.wav")
    sf.write(vocals_path, vocals.T, model_sr, subtype="PCM_16")
    sf.write(instrumental_path, instrumental.T, model_sr, subtype="PCM_16")

    return vocals_path, instrumental_path


# ── RVC 변환 ──
def convert_vocals(vocals_path: str, model_path: str, index_path: str | None, pitch_shift: int, output_path: str):
    """RVC v2로 보컬 음성 변환"""
    from rvc_python.infer import RVCInference

    rvc = RVCInference(device="cuda:0")
    rvc.load_model(model_path)

    if index_path:
        rvc.set_params(index_path=index_path, index_rate=0.75)

    rvc.infer_file(
        input_path=vocals_path,
        output_path=output_path,
        f0method="rmvpe",
        f0up_key=pitch_shift,
    )


# ── 믹싱 ──
def mix_audio(vocals_path: str, instrumental_path: str, output_path: str, vocals_vol: float = 1.0):
    """변환된 보컬 + 반주 믹싱"""
    import numpy as np
    import soundfile as sf

    vocals, sr_v = sf.read(vocals_path)
    inst, sr_i = sf.read(instrumental_path)

    # 샘플레이트 맞추기
    if sr_v != sr_i:
        import torchaudio
        import torch
        vocals_t = torch.tensor(vocals.T if vocals.ndim > 1 else vocals.reshape(1, -1), dtype=torch.float32)
        vocals_t = torchaudio.transforms.Resample(sr_v, sr_i)(vocals_t)
        vocals = vocals_t.numpy().T

    # 길이 맞추기
    min_len = min(len(vocals), len(inst))
    vocals = vocals[:min_len]
    inst = inst[:min_len]

    # 모노→스테레오 호환
    if vocals.ndim == 1 and inst.ndim > 1:
        vocals = np.stack([vocals, vocals], axis=1)
    elif inst.ndim == 1 and vocals.ndim > 1:
        inst = np.stack([inst, inst], axis=1)

    mixed = inst + vocals * vocals_vol
    # 클리핑 방지
    peak = np.abs(mixed).max()
    if peak > 0.99:
        mixed = mixed * 0.99 / peak

    sf.write(output_path, mixed, sr_i, subtype="PCM_16")


# ═══════════════════════════════════════════
# 변환 엔드포인트 (POST /convert)
# ═══════════════════════════════════════════
@app.function(
    image=rvc_image,
    gpu="T4",
    timeout=600,
    scaledown_window=60,
    secrets=[supabase_secret],
)
@modal.fastapi_endpoint(method="POST")
async def convert(request):
    """
    AI 커버 변환: 원곡 → Demucs 분리 → RVC 변환 → 믹싱 → 업로드
    Body JSON: { conversion_id, song_path, model_path, index_path, pitch_shift, user_id, song_id }
    """
    import tempfile
    from pathlib import Path

    body = await request.json()
    conversion_id = body["conversion_id"]
    song_path = body["song_path"]
    model_path = body["model_path"]
    index_path = body.get("index_path")
    pitch_shift = body.get("pitch_shift", 0)
    user_id = body["user_id"]
    song_id = body["song_id"]

    sb = SupabaseClient()
    work_dir = tempfile.mkdtemp()

    try:
        # 1. 상태 업데이트: separating
        sb.update_record("ai_cover_conversions", conversion_id, {"status": "separating"})

        # 2. 원곡 다운로드
        local_song = str(Path(work_dir) / "original.wav")
        sb.download_storage("ai-cover-songs", song_path, local_song)

        # 3. Demucs 분리
        vocals_path, instrumental_path = separate_vocals(local_song, work_dir)

        # 분리 결과 업로드 (보컬 + 반주 따로 저장)
        vocals_storage = f"{user_id}/{song_id}/vocals.wav"
        inst_storage = f"{user_id}/{song_id}/instrumental.wav"
        sb.upload_storage("ai-cover-songs", vocals_storage, vocals_path)
        sb.upload_storage("ai-cover-songs", inst_storage, instrumental_path)
        sb.update_record("ai_cover_songs", song_id, {
            "vocals_path": vocals_storage,
            "instrumental_path": inst_storage,
            "separation_status": "completed",
        })

        # 4. 상태 업데이트: converting
        sb.update_record("ai_cover_conversions", conversion_id, {"status": "converting"})

        # 5. 모델 다운로드
        local_model = str(Path(work_dir) / "model.pth")
        sb.download_storage("ai-cover-models", model_path, local_model)

        local_index = None
        if index_path:
            local_index = str(Path(work_dir) / "model.index")
            sb.download_storage("ai-cover-models", index_path, local_index)

        # 6. RVC 변환
        converted_vocals = str(Path(work_dir) / "converted_vocals.wav")
        convert_vocals(vocals_path, local_model, local_index, pitch_shift, converted_vocals)

        # 7. 믹싱
        final_output = str(Path(work_dir) / "final.wav")
        mix_audio(converted_vocals, instrumental_path, final_output)

        # 8. 결과 업로드
        result_path = f"{user_id}/{song_id}/{conversion_id}/cover.wav"
        sb.upload_storage("ai-cover-output", result_path, final_output)

        # 9. 완료 상태
        sb.update_record("ai_cover_conversions", conversion_id, {
            "status": "completed",
            "output_path": result_path,
        })

        return {"status": "completed", "output_path": result_path}

    except Exception as e:
        # 실패 시 DB 상태 업데이트
        try:
            sb.update_record("ai_cover_conversions", conversion_id, {
                "status": "failed",
                "error_message": str(e)[:500],
            })
        except Exception:
            pass
        return {"status": "failed", "error": str(e)[:500]}

    finally:
        # 임시 파일 정리
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)


# ═══════════════════════════════════════════
# 학습 엔드포인트 (POST /train)
# ═══════════════════════════════════════════
@app.function(
    image=rvc_image,
    gpu="T4",
    timeout=2400,  # 최대 40분
    scaledown_window=60,
    secrets=[supabase_secret],
)
@modal.fastapi_endpoint(method="POST")
async def train(request):
    """
    RVC 모델 학습: 녹음 다운로드 → 전처리 → 학습 → 모델 업로드
    Body JSON: { model_id, recording_paths, user_id, model_name, epochs }
    """
    import tempfile
    import os
    from pathlib import Path

    body = await request.json()
    model_id = body["model_id"]
    recording_paths = body["recording_paths"]
    user_id = body["user_id"]
    model_name = body.get("model_name", "my_voice")
    epochs = body.get("epochs", 50)

    sb = SupabaseClient()
    work_dir = tempfile.mkdtemp()

    try:
        sb.update_record("voice_models", model_id, {"status": "downloading"})

        # 1. 녹음 파일 다운로드
        dataset_dir = Path(work_dir) / "dataset"
        dataset_dir.mkdir()
        for i, rec_path in enumerate(recording_paths):
            local_path = str(dataset_dir / f"recording_{i:03d}.wav")
            sb.download_storage("ai-cover-models", rec_path, local_path)

        sb.update_record("voice_models", model_id, {"status": "training"})

        # 2. RVC 학습 (rvc-python 패키지 사용)
        from rvc_python.train import RVCTraining

        output_dir = Path(work_dir) / "output"
        output_dir.mkdir()

        trainer = RVCTraining(device="cuda:0")
        model_file, index_file = trainer.train(
            dataset_path=str(dataset_dir),
            model_name=model_name,
            output_path=str(output_dir),
            epochs=epochs,
            batch_size=8,
            sample_rate=40000,
            f0method="rmvpe",
        )

        # 3. 모델 + 인덱스 업로드
        model_storage_path = f"{user_id}/{model_id}/model.pth"
        sb.upload_storage("ai-cover-models", model_storage_path, model_file, "application/octet-stream")

        index_storage_path = None
        if index_file and os.path.exists(index_file):
            index_storage_path = f"{user_id}/{model_id}/model.index"
            sb.upload_storage("ai-cover-models", index_storage_path, index_file, "application/octet-stream")

        # 4. 완료
        sb.update_record("voice_models", model_id, {
            "status": "completed",
            "model_path": model_storage_path,
            "index_path": index_storage_path,
        })

        return {"status": "completed", "model_path": model_storage_path}

    except Exception as e:
        try:
            sb.update_record("voice_models", model_id, {
                "status": "failed",
                "error_message": str(e)[:500],
            })
        except Exception:
            pass
        return {"status": "failed", "error": str(e)[:500]}

    finally:
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)


# ═══════════════════════════════════════════
# Studio Phase 0: convert_studio (callback 패턴)
# ═══════════════════════════════════════════

orchestrator_secret = modal.Secret.from_name(
    "vocalmind-orchestrator", required_keys=["ORCHESTRATOR_SECRET"],
)


def _post_callback(url: str, payload: dict) -> None:
    import os
    import httpx
    try:
        httpx.post(
            url,
            json=payload,
            headers={
                "X-Orchestrator-Secret": os.environ.get("ORCHESTRATOR_SECRET", ""),
                "Content-Type": "application/json",
            },
            timeout=20.0,
        )
    except httpx.HTTPError as e:
        print(f"[rvc_studio] callback 실패 job_id={payload.get('job_id')}: {e}")


def _lookup_voice_identity(voice_identity_id: str) -> tuple[str, str | None]:
    """voice_identities 테이블에서 rvc_model_path, rvc_index_path 조회."""
    import os
    import httpx
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    r = httpx.get(
        f"{url}/rest/v1/voice_identities",
        params={"id": f"eq.{voice_identity_id}", "select": "rvc_model_path,rvc_index_path,status"},
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        timeout=15.0,
    )
    r.raise_for_status()
    rows = r.json()
    if not rows:
        raise ValueError(f"voice_identity 없음: {voice_identity_id}")
    row = rows[0]
    if row.get("status") != "ready":
        raise ValueError(f"voice_identity 미완성 상태={row.get('status')}")
    model_path = row.get("rvc_model_path")
    if not model_path:
        raise ValueError("rvc_model_path 누락")
    return model_path, row.get("rvc_index_path")


@app.function(
    image=rvc_image,
    gpu="T4",
    timeout=600,
    scaledown_window=60,
    secrets=[supabase_secret, orchestrator_secret],
)
def _process_convert_studio(
    job_id: str,
    vocals_url: str,
    voice_identity_id: str,
    callback_url: str,
    step: str,
    output_bucket: str,
    output_prefix: str,
) -> None:
    """vocals_url 다운로드 → RVC 변환 → Storage 업로드 → callback."""
    import os
    import tempfile
    import traceback
    from pathlib import Path

    import httpx

    work = Path(tempfile.mkdtemp())
    try:
        # 1) voice_identity 조회
        rvc_model_storage, rvc_index_storage = _lookup_voice_identity(voice_identity_id)

        # 2) 보컬 다운로드
        vocals_path = work / "vocals.wav"
        with httpx.Client(timeout=60.0) as client:
            with client.stream("GET", vocals_url) as r:
                r.raise_for_status()
                with open(vocals_path, "wb") as f:
                    for chunk in r.iter_bytes():
                        f.write(chunk)

        # 3) RVC 모델/인덱스 다운로드 (ai-cover-models 또는 voice-identities 버킷)
        sb = SupabaseClient()
        rvc_bucket, rvc_key = rvc_model_storage.split("/", 1)
        model_local = work / "model.pth"
        sb.download_storage(rvc_bucket, rvc_key, str(model_local))

        index_local = None
        if rvc_index_storage:
            idx_bucket, idx_key = rvc_index_storage.split("/", 1)
            index_local = work / "model.index"
            sb.download_storage(idx_bucket, idx_key, str(index_local))

        # 4) RVC 변환
        converted_local = work / "converted_vocals.wav"
        convert_vocals(
            vocals_path=str(vocals_path),
            model_path=str(model_local),
            index_path=str(index_local) if index_local else None,
            pitch_shift=0,
            output_path=str(converted_local),
        )

        # 5) Supabase Storage 업로드
        out_key = f"{output_prefix}/converted_vocals.wav"
        sb.upload_storage(output_bucket, out_key, str(converted_local), "audio/wav")

        _post_callback(callback_url, {
            "job_id": job_id,
            "step": step,
            "status": "success",
            "result": {
                "converted_vocals_path": f"{output_bucket}/{out_key}",
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
        import shutil
        shutil.rmtree(str(work), ignore_errors=True)


@app.function(
    image=rvc_image,
    cpu=0.5,
    memory=512,
    timeout=30,
    secrets=[orchestrator_secret],
)
@modal.fastapi_endpoint(method="POST")
async def convert_studio(request):
    """POST JSON {job_id, vocals_url, voice_identity_id, callback_url, step, output_bucket, output_prefix}."""
    body = await request.json()
    required = [
        "job_id", "vocals_url", "voice_identity_id", "callback_url",
        "step", "output_bucket", "output_prefix",
    ]
    missing = [k for k in required if not body.get(k)]
    if missing:
        return {"error": f"필수 필드 누락: {missing}", "code": "MISSING_FIELDS"}

    _process_convert_studio.spawn(
        body["job_id"],
        body["vocals_url"],
        body["voice_identity_id"],
        body["callback_url"],
        body["step"],
        body["output_bucket"],
        body["output_prefix"],
    )
    return {"accepted": True, "job_id": body["job_id"]}
