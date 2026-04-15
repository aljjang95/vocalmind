"""
VocalMind Modal - Web API 엔드포인트
Next.js API Routes에서 HTTP로 호출한다.

패턴:
  1. Next.js → Supabase Storage에 파일 업로드 + DB 레코드 생성
  2. Next.js → Modal web endpoint 호출 (conversion_id, 경로 전달)
  3. Modal → Supabase에서 파일 다운로드 → 처리 → 결과 업로드 → DB 상태 업데이트
  4. Next.js 프론트엔드 → status API 폴링
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
        "demucs==4.0.1",
        "transformers>=4.40.0",
        "librosa>=0.10.0",
        "soundfile>=0.12.0",
        "numpy<2",
        "scipy",
        "faiss-cpu",
        "pyworld",
        "praat-parselmouth",
        "supabase>=2.0.0",
        "fastapi[standard]",
        "pedalboard>=0.9",
        "pyloudnorm>=0.1",
    )
    .add_local_python_source("modal_app")
)

model_volume = modal.Volume.from_name("vocalmind-models", create_if_missing=True)

# Supabase 접속 정보 — Modal Secret에서 가져옴
supabase_secret = modal.Secret.from_name("supabase-credentials")


def _pro_mix(vocal_audio, inst_audio, sr):
    """보컬(-12 LUFS) + 반주(-17 LUFS) → 마스터(-14 LUFS)"""
    import io
    import numpy as np
    import soundfile as sf
    import pyloudnorm as pyln

    def _normalize_lufs(audio, sr, target):
        if audio.ndim == 1:
            audio = audio[:, np.newaxis]
        meter = pyln.Meter(sr)
        loudness = meter.integrated_loudness(audio)
        if np.isinf(loudness) or np.isnan(loudness):
            return audio
        return pyln.normalize.loudness(audio, loudness, target)

    vocal_norm = _normalize_lufs(vocal_audio, sr, -12.0)
    inst_norm = _normalize_lufs(inst_audio, sr, -17.0)

    # 모노 → 스테레오
    if vocal_norm.ndim == 1:
        vocal_norm = vocal_norm[:, np.newaxis]
    if inst_norm.ndim == 1:
        inst_norm = inst_norm[:, np.newaxis]

    # 채널 수 맞추기
    if vocal_norm.shape[1] != inst_norm.shape[1]:
        if vocal_norm.shape[1] == 1:
            vocal_norm = np.repeat(vocal_norm, inst_norm.shape[1], axis=1)
        elif inst_norm.shape[1] == 1:
            inst_norm = np.repeat(inst_norm, vocal_norm.shape[1], axis=1)

    # 길이 맞추기
    min_len = min(len(vocal_norm), len(inst_norm))
    mixed = vocal_norm[:min_len] + inst_norm[:min_len]

    # 마스터 LUFS
    master = _normalize_lufs(mixed, sr, -14.0)
    peak = np.max(np.abs(master))
    if peak > 0.99:
        master = master * (0.99 / peak)

    buf = io.BytesIO()
    sf.write(buf, master, sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def _get_supabase_client():
    """Supabase 서비스 역할 클라이언트를 생성한다."""
    import os
    from supabase import create_client

    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )


def _download_from_storage(supabase, bucket: str, path: str) -> bytes:
    """Supabase Storage에서 파일을 다운로드한다."""
    return supabase.storage.from_(bucket).download(path)


def _upload_to_storage(supabase, bucket: str, path: str, data: bytes, content_type: str = "audio/wav"):
    """Supabase Storage에 파일을 업로드한다."""
    supabase.storage.from_(bucket).upload(
        path, data,
        file_options={"content-type": content_type, "upsert": "true"},
    )


# ──────────────────────────────────────────────
# 보컬 분리 + 음성 변환 통합 엔드포인트
# ──────────────────────────────────────────────

@app.function(
    image=gpu_image,
    gpu="T4",
    timeout=600,
    volumes={"/models": model_volume},
    secrets=[supabase_secret],
)
@modal.fastapi_endpoint(method="POST", docs=True)
def process_conversion(item: dict):
    """
    변환 파이프라인: 보컬 분리 → 음성 변환 → 믹싱 → 업로드.

    입력 (JSON):
        conversion_id: 변환 레코드 UUID
        song_path: Supabase Storage 경로 (ai-cover-songs 버킷)
        model_path: 모델 파일 경로 (ai-cover-models 버킷)
        index_path: 인덱스 파일 경로 (선택, ai-cover-models 버킷)
        pitch_shift: 피치 시프트 (반음 단위, 기본 0)
        user_id: 사용자 UUID (결과 저장 경로용)
        song_id: 노래 UUID (분리 결과 경로용)
    """
    import io
    import logging
    import traceback

    import numpy as np
    import soundfile as sf

    logger = logging.getLogger(__name__)

    conversion_id = item["conversion_id"]
    song_path = item["song_path"]
    model_path = item["model_path"]
    index_path = item.get("index_path")
    pitch_shift = item.get("pitch_shift", 0)
    user_id = item["user_id"]
    song_id = item["song_id"]

    supabase = _get_supabase_client()

    try:
        # ── 1) 보컬 분리 ──
        logger.info("보컬 분리 시작: %s", song_path)
        _update_status(supabase, "ai_cover_conversions", conversion_id, "separating")

        audio_bytes = _download_from_storage(supabase, "ai-cover-songs", song_path)

        from separate import separate
        sep_result = separate.local(audio_bytes)

        # 분리 결과 업로드
        vocals_path = f"{user_id}/{song_id}/vocals.wav"
        inst_path = f"{user_id}/{song_id}/instrumental.wav"
        _upload_to_storage(supabase, "ai-cover-songs", vocals_path, sep_result["vocals"])
        _upload_to_storage(supabase, "ai-cover-songs", inst_path, sep_result["instrumental"])

        # 노래 레코드 업데이트
        supabase.table("ai_cover_songs").update({
            "vocals_path": vocals_path,
            "instrumental_path": inst_path,
            "separation_status": "completed",
        }).eq("id", song_id).execute()

        # ── 2) 음성 변환 ──
        logger.info("음성 변환 시작")
        _update_status(supabase, "ai_cover_conversions", conversion_id, "converting")

        model_bytes = _download_from_storage(supabase, "ai-cover-models", model_path)
        index_bytes = None
        if index_path:
            index_bytes = _download_from_storage(supabase, "ai-cover-models", index_path)

        preset_name = item.get("preset_name", "default")

        from convert import convert
        converted_bytes = convert.local(
            vocals_bytes=sep_result["vocals"],
            model_bytes=model_bytes,
            index_bytes=index_bytes,
            pitch_shift=pitch_shift,
            postprocess=True,
            preset_name=preset_name,
        )

        # ── 3) 프로 믹싱 (후처리 보컬 + 반주 LUFS 밸런싱) ──
        logger.info("프로 믹싱 시작")
        _update_status(supabase, "ai_cover_conversions", conversion_id, "mixing")

        converted_audio, conv_sr = sf.read(io.BytesIO(converted_bytes))
        inst_audio, inst_sr = sf.read(io.BytesIO(sep_result["instrumental"]))

        # 샘플레이트 맞추기
        if conv_sr != inst_sr:
            import librosa
            converted_audio = librosa.resample(
                converted_audio, orig_sr=conv_sr, target_sr=inst_sr,
            )
            conv_sr = inst_sr

        mixed_bytes = _pro_mix(converted_audio, inst_audio, conv_sr)

        # 결과 업로드
        output_path = f"{user_id}/{conversion_id}/output.wav"
        _upload_to_storage(supabase, "ai-cover-output", output_path, mixed_bytes)

        # DB 상태 업데이트
        supabase.table("ai_cover_conversions").update({
            "output_path": output_path,
            "status": "completed",
        }).eq("id", conversion_id).execute()

        logger.info("변환 완료: %s", output_path)
        return {"status": "completed", "output_path": output_path}

    except Exception as e:
        logger.error("변환 실패: %s\n%s", e, traceback.format_exc())
        supabase.table("ai_cover_conversions").update({
            "status": "failed",
            "error_message": str(e)[:500],
        }).eq("id", conversion_id).execute()
        return {"status": "failed", "error": str(e)[:500]}


# ──────────────────────────────────────────────
# 모델 학습 엔드포인트
# ──────────────────────────────────────────────

@app.function(
    image=gpu_image,
    gpu="T4",
    timeout=3600,
    volumes={"/models": model_volume},
    secrets=[supabase_secret],
)
@modal.fastapi_endpoint(method="POST", docs=True)
def process_training(item: dict):
    """
    모델 학습 파이프라인: 녹음 다운로드 → RVC 학습 → 모델 업로드.

    입력 (JSON):
        model_id: 모델 레코드 UUID
        recording_paths: Supabase Storage 경로 리스트 (ai-cover-models 버킷)
        user_id: 사용자 UUID
        model_name: 모델 이름
        epochs: 학습 에포크 수 (기본 50)
    """
    import logging
    import traceback

    logger = logging.getLogger(__name__)

    model_id = item["model_id"]
    recording_paths = item["recording_paths"]
    user_id = item["user_id"]
    model_name = item.get("model_name", "user_model")
    epochs = item.get("epochs", 50)

    supabase = _get_supabase_client()

    try:
        _update_status(supabase, "voice_models", model_id, "training")

        # 녹음 파일 다운로드
        logger.info("녹음 %d개 다운로드 중...", len(recording_paths))
        recording_bytes_list = []
        for path in recording_paths:
            audio_bytes = _download_from_storage(supabase, "ai-cover-models", path)
            recording_bytes_list.append(audio_bytes)

        if not recording_bytes_list:
            raise ValueError("다운로드된 녹음 파일이 없습니다")

        # 학습 실행
        logger.info("RVC 학습 시작 (에포크: %d)", epochs)
        from train import train
        result = train.local(
            recording_bytes_list=recording_bytes_list,
            model_name=model_name,
            epochs=epochs,
        )

        # 결과 업로드
        model_storage_path = f"{user_id}/{model_id}/model.pth"
        index_storage_path = f"{user_id}/{model_id}/model.index"

        _upload_to_storage(
            supabase, "ai-cover-models", model_storage_path,
            result["model"], "application/octet-stream",
        )
        _upload_to_storage(
            supabase, "ai-cover-models", index_storage_path,
            result["index"], "application/octet-stream",
        )

        # DB 업데이트
        supabase.table("voice_models").update({
            "model_path": model_storage_path,
            "index_path": index_storage_path,
            "status": "completed",
        }).eq("id", model_id).execute()

        logger.info("학습 완료: %s", model_storage_path)
        return {"status": "completed", "model_path": model_storage_path}

    except Exception as e:
        logger.error("학습 실패: %s\n%s", e, traceback.format_exc())
        supabase.table("voice_models").update({
            "status": "failed",
        }).eq("id", model_id).execute()
        return {"status": "failed", "error": str(e)[:500]}


# ──────────────────────────────────────────────
# 유틸리티
# ──────────────────────────────────────────────

def _update_status(supabase, table: str, record_id: str, status: str):
    """DB 레코드 상태를 업데이트한다."""
    supabase.table(table).update({"status": status}).eq("id", record_id).execute()
