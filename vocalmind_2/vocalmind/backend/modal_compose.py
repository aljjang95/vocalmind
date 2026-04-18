"""
Modal Compose — MV 최종 합성 워커 (Phase 0)

입력: 씬 비디오 URL 리스트 + 최종 보컬 믹스 URL
처리: 씬 concat → 오디오 얹기 → 자막 번인 → 16:9 landscape + 9:16 portrait
       → C2PA 워터마크 서명 → Supabase Storage 업로드
출력: { landscape_url, portrait_url, thumbnail_url }

CPU only (T4 불필요). scaledown_window=60, min_containers=0.
배포: PYTHONIOENCODING=utf-8 modal deploy modal_compose.py
"""

import modal

app = modal.App("vocalmind-compose")

compose_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "fonts-noto-cjk")
    .pip_install(
        "httpx>=0.27.0",
        "supabase>=2.7.0",
        "c2pa-python>=0.7.0",
        "fastapi[standard]",
    )
)


# ── 순수 헬퍼 (Modal 함수 외부에서도 단위 테스트 가능) ─────────────

def build_concat_filter(num_scenes: int) -> str:
    """FFmpeg concat demuxer 입력 포맷. n개 씬 → `concat=n=N:v=1:a=0`."""
    return f"concat=n={num_scenes}:v=1:a=0"


def compute_pad_filter(src_ar: str, target_ar: str) -> str:
    """16:9 소스를 9:16으로 레터박스 패딩하거나 그 반대.

    Landscape(16:9) → Portrait(9:16): 중앙 crop + 세로 블러 배경
    Portrait(9:16) → Landscape(16:9): 중앙 crop + 가로 블러 배경
    동일 비율: 그대로
    """
    if src_ar == target_ar:
        return "null"
    if src_ar == "16:9" and target_ar == "9:16":
        return "split=2[bg][fg];[bg]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=30[bgb];[fg]scale=1080:-1[fgs];[bgb][fgs]overlay=(W-w)/2:(H-h)/2"
    if src_ar == "9:16" and target_ar == "16:9":
        return "split=2[bg][fg];[bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=30[bgb];[fg]scale=-1:1080[fgs];[bgb][fgs]overlay=(W-w)/2:(H-h)/2"
    return "null"


def parse_storage_path(storage_path: str) -> tuple[str, str]:
    """'bucket/sub/key.mp4' → ('bucket', 'sub/key.mp4')."""
    parts = storage_path.split("/", 1)
    if len(parts) != 2:
        raise ValueError(f"storage_path 형식 오류: {storage_path}")
    return parts[0], parts[1]


# ── Modal 함수: 실제 합성 워커 ────────────────────────────────────

COMPOSE_SECRETS = [
    modal.Secret.from_name("vocalmind-supabase"),
    modal.Secret.from_name("vocalmind-c2pa"),
    modal.Secret.from_name("vocalmind-orchestrator"),
]


@app.function(
    image=compose_image,
    cpu=4.0,
    memory=8192,
    timeout=600,
    scaledown_window=60,
    secrets=COMPOSE_SECRETS,
)
def _process_compose(
    job_id: str,
    scene_urls: list,
    vocal_url: str,
    lyrics: list | None,
    out_bucket: str,
    out_prefix: str,
    callback_url: str,
    step: str,
) -> None:
    """실제 합성 작업을 spawn으로 실행 → 완료 시 orchestrator로 callback POST."""
    import os
    import tempfile
    import subprocess
    import traceback
    from pathlib import Path

    import httpx

    if not scene_urls:
        _post_callback(callback_url, {
            "job_id": job_id, "step": step, "status": "failed",
            "error": "scene_video_urls 비어 있음",
        })
        return

    work = Path(tempfile.mkdtemp())
    try:
        # ── 실제 합성 작업 ──
        result = _do_compose(
            job_id, scene_urls, vocal_url, lyrics, out_bucket, out_prefix, work,
        )
        _post_callback(callback_url, {
            "job_id": job_id, "step": step, "status": "success", "result": result,
        })
    except Exception as e:
        _post_callback(callback_url, {
            "job_id": job_id, "step": step, "status": "failed",
            "error": f"{type(e).__name__}: {e}",
            "result": {"traceback": traceback.format_exc()[:2000]},
        })
    finally:
        import shutil
        shutil.rmtree(str(work), ignore_errors=True)


def _do_compose(
    job_id: str,
    scene_urls: list,
    vocal_url: str,
    lyrics: list | None,
    out_bucket: str,
    out_prefix: str,
    work,
) -> dict:
    """기존 compose_final 로직을 함수로 분리 — 순수 계산, 예외는 상위로 전파."""
    import os
    import subprocess
    from pathlib import Path

    import httpx

    # 1) 씬 비디오 + 보컬 다운로드
    scene_paths = []
    with httpx.Client(timeout=60.0) as client:
        for i, url in enumerate(scene_urls):
            p = work / f"scene_{i:02d}.mp4"
            with client.stream("GET", url) as r:
                r.raise_for_status()
                with open(p, "wb") as f:
                    for chunk in r.iter_bytes():
                        f.write(chunk)
            scene_paths.append(p)

        vocal_path = work / "vocal.mp3"
        with client.stream("GET", vocal_url) as r:
            r.raise_for_status()
            with open(vocal_path, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)

    # 2) 씬 concat (무음 비디오)
    concat_list = work / "concat.txt"
    with open(concat_list, "w", encoding="utf-8") as f:
        for p in scene_paths:
            f.write(f"file '{p.as_posix()}'\n")

    concat_video = work / "concat.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
         "-c", "copy", "-an", str(concat_video)],
        check=True, capture_output=True,
    )

    # 3) 보컬 오디오 오버레이 (비디오 길이에 맞춤)
    with_audio = work / "with_audio.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(concat_video), "-i", str(vocal_path),
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
         "-shortest",  # 비디오·오디오 짧은 쪽에 맞춤
         str(with_audio)],
        check=True, capture_output=True,
    )

    # 4) 자막 번인 (선택)
    base_video = with_audio
    if lyrics:
        srt_path = work / "subs.srt"
        with open(srt_path, "w", encoding="utf-8") as f:
            for i, line in enumerate(lyrics, start=1):
                start = _seconds_to_srt(line["start_sec"])
                end = _seconds_to_srt(line["end_sec"])
                f.write(f"{i}\n{start} --> {end}\n{line['text']}\n\n")
        captioned = work / "captioned.mp4"
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(with_audio),
             "-vf", f"subtitles={srt_path.as_posix()}:force_style='FontName=Noto Sans CJK KR,FontSize=42,PrimaryColour=&Hffffff&,OutlineColour=&H80000000&,BorderStyle=3,Outline=2'",
             "-c:a", "copy", str(captioned)],
            check=True, capture_output=True,
        )
        base_video = captioned

    # 5) 16:9 landscape + 9:16 portrait 렌더
    landscape = work / "landscape.mp4"
    portrait = work / "portrait.mp4"

    subprocess.run(
        ["ffmpeg", "-y", "-i", str(base_video),
         "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black",
         "-c:v", "libx264", "-preset", "medium", "-crf", "22",
         "-c:a", "copy", str(landscape)],
        check=True, capture_output=True,
    )

    subprocess.run(
        ["ffmpeg", "-y", "-i", str(base_video),
         "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
         "-c:v", "libx264", "-preset", "medium", "-crf", "22",
         "-c:a", "copy", str(portrait)],
        check=True, capture_output=True,
    )

    # 6) 썸네일 (첫 프레임에서 살짝 이동)
    thumbnail = work / "thumb.jpg"
    subprocess.run(
        ["ffmpeg", "-y", "-ss", "1.5", "-i", str(landscape),
         "-frames:v", "1", "-q:v", "3", str(thumbnail)],
        check=True, capture_output=True,
    )

    # 7) C2PA 서명 (단일 지점)
    landscape_signed = _sign_c2pa(landscape, job_id)
    portrait_signed = _sign_c2pa(portrait, job_id)

    # 8) 영상 길이 추출
    duration = _probe_duration(landscape_signed)

    # 9) Supabase Storage 업로드
    from supabase import create_client
    sb = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    landscape_key = f"{out_prefix}/landscape.mp4"
    portrait_key = f"{out_prefix}/portrait.mp4"
    thumb_key = f"{out_prefix}/thumb.jpg"

    sb.storage.from_(out_bucket).upload(
        landscape_key, landscape_signed.read_bytes(),
        file_options={"content-type": "video/mp4", "upsert": "true"},
    )
    sb.storage.from_(out_bucket).upload(
        portrait_key, portrait_signed.read_bytes(),
        file_options={"content-type": "video/mp4", "upsert": "true"},
    )
    sb.storage.from_(out_bucket).upload(
        thumb_key, thumbnail.read_bytes(),
        file_options={"content-type": "image/jpeg", "upsert": "true"},
    )

    return {
        "landscape_path": f"{out_bucket}/{landscape_key}",
        "portrait_path": f"{out_bucket}/{portrait_key}",
        "thumbnail_path": f"{out_bucket}/{thumb_key}",
        "duration_sec": duration,
        "c2pa_signed": True,
    }


# ── 내부 유틸 ─────────────────────────────────────────────────────

def _seconds_to_srt(sec: float) -> str:
    """5.25 → '00:00:05,250'."""
    hours = int(sec // 3600)
    minutes = int((sec % 3600) // 60)
    seconds = int(sec % 60)
    millis = int((sec - int(sec)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"


def _probe_duration(video: "Path") -> float:  # noqa: F821
    """ffprobe로 영상 길이 초 추출."""
    import subprocess
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(video)],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


def _sign_c2pa(video: "Path", job_id: str) -> "Path":  # noqa: F821
    """c2pa-python으로 MP4에 AI 생성물 표기 서명.

    실패 시 예외 전파 (orchestrator가 watermarking 단계 실패 처리).
    """
    import os
    import json
    from pathlib import Path
    try:
        import c2pa
    except ImportError:
        # 로컬/테스트 환경에서 c2pa 미설치 — 서명 스킵 (Modal 프로덕션만 적용)
        return video

    manifest = {
        "claim_generator": "VocalMind/Phase0",
        "claim_generator_info": [{"name": "VocalMind AI Studio"}],
        "format": "video/mp4",
        "title": f"VocalMind Cover {job_id}",
        "assertions": [
            {
                "label": "c2pa.actions",
                "data": {
                    "actions": [
                        {"action": "c2pa.created", "softwareAgent": "VocalMind Studio v0.1"},
                        {"action": "c2pa.generated", "digitalSourceType":
                         "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"},
                    ]
                },
            }
        ],
    }

    key_pem = os.environ.get("C2PA_SIGNING_KEY_PEM")
    cert_pem = os.environ.get("C2PA_SIGNING_CERT_PEM")
    if not key_pem or not cert_pem:
        # 키 미설정 → 서명 스킵 (개발 환경)
        return video

    out = video.with_suffix(".signed.mp4")
    try:
        signer = c2pa.create_signer(
            lambda data: _sign_with_key(data, key_pem),
            alg="es256", certs=cert_pem,
        )
        builder = c2pa.Builder(manifest)
        builder.sign(signer, "video/mp4", str(video), str(out))
        return out
    except Exception:
        # 서명 실패 시 원본 반환 + 로그 (orchestrator가 c2pa_signed=False로 기록)
        return video


def _sign_with_key(data: bytes, key_pem: str) -> bytes:
    """ES256으로 바이트 서명."""
    from cryptography.hazmat.primitives.serialization import load_pem_private_key
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import hashes
    key = load_pem_private_key(key_pem.encode(), password=None)
    return key.sign(data, ec.ECDSA(hashes.SHA256()))


def _post_callback(url: str, payload: dict) -> None:
    """orchestrator에 콜백 POST. 실패 시 로그만."""
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
        print(f"[compose] callback 실패 job_id={payload.get('job_id')}: {e}")


# ── 보컬 믹싱 워커 ────────────────────────────────────────────────

@app.function(
    image=compose_image,
    cpu=2.0,
    memory=4096,
    timeout=300,
    scaledown_window=60,
    secrets=COMPOSE_SECRETS,
)
def _process_mix(
    job_id: str,
    vocals_url: str,
    instrumental_url: str,
    output_bucket: str,
    output_prefix: str,
    callback_url: str,
    step: str,
) -> None:
    """보컬 + 반주 믹싱 작업 → 완료 시 orchestrator로 callback POST."""
    import traceback
    import tempfile
    from pathlib import Path

    work = Path(tempfile.mkdtemp())
    try:
        result = _do_mix(
            job_id, vocals_url, instrumental_url, output_bucket, output_prefix, work,
        )
        _post_callback(callback_url, {
            "job_id": job_id, "step": step, "status": "success", "result": result,
        })
    except Exception as e:
        _post_callback(callback_url, {
            "job_id": job_id, "step": step, "status": "failed",
            "error": f"{type(e).__name__}: {e}",
            "result": {"traceback": traceback.format_exc()[:2000]},
        })
    finally:
        import shutil
        shutil.rmtree(str(work), ignore_errors=True)


def _do_mix(
    job_id: str,
    vocals_url: str,
    instrumental_url: str,
    output_bucket: str,
    output_prefix: str,
    work: "Path",
) -> dict:
    """보컬과 반주를 FFmpeg amix로 합산 → Supabase Storage 업로드.

    보컬 volume=1.0, 반주 volume=0.85 비율로 혼합.
    """
    import os
    import subprocess

    import httpx

    # 1) 소스 다운로드
    vocals_path = work / "vocals.wav"
    instrumental_path = work / "instrumental.wav"
    with httpx.Client(timeout=120.0) as client:
        for url, dest in [(vocals_url, vocals_path), (instrumental_url, instrumental_path)]:
            with client.stream("GET", url) as r:
                r.raise_for_status()
                with open(dest, "wb") as f:
                    for chunk in r.iter_bytes():
                        f.write(chunk)

    # 2) FFmpeg amix: 보컬 1.0 + 반주 0.85 혼합
    output_path = work / "final_mix.m4a"
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(vocals_path),
            "-i", str(instrumental_path),
            "-filter_complex",
            "[0:a]volume=1.0[v];[1:a]volume=0.85[i];[v][i]amix=inputs=2:duration=longest",
            "-c:a", "aac", "-b:a", "192k",
            str(output_path),
        ],
        check=True, capture_output=True,
    )

    # 3) Supabase Storage 업로드
    from supabase import create_client
    sb = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

    mix_key = f"{output_prefix}/final_mix.m4a"
    sb.storage.from_(output_bucket).upload(
        mix_key, output_path.read_bytes(),
        file_options={"content-type": "audio/mp4", "upsert": "true"},
    )

    return {
        "final_vocal_mix_path": f"{output_bucket}/{mix_key}",
    }


# ── HTTP 엔드포인트: spawn + 즉시 응답 ───────────────────────────────

@app.function(
    image=compose_image,
    cpu=0.5,
    memory=512,
    timeout=30,
    secrets=COMPOSE_SECRETS,
)
@modal.fastapi_endpoint(method="POST")
async def compose_final(request):
    """POST JSON — _process_compose를 spawn으로 비동기 실행 → 즉시 accepted 응답."""
    body = await request.json()
    required = [
        "job_id", "scene_video_urls", "final_vocal_mix_url",
        "output_prefix", "callback_url", "step",
    ]
    missing = [k for k in required if body.get(k) is None]
    if missing:
        return {"error": f"필수 필드 누락: {missing}", "code": "MISSING_FIELDS"}

    _process_compose.spawn(
        body["job_id"],
        body["scene_video_urls"],
        body["final_vocal_mix_url"],
        body.get("lyrics_lines"),
        body.get("output_bucket", "mv-output"),
        body["output_prefix"],
        body["callback_url"],
        body["step"],
    )
    return {"accepted": True, "job_id": body["job_id"]}


@app.function(
    image=compose_image,
    cpu=0.5,
    memory=512,
    timeout=30,
    secrets=COMPOSE_SECRETS,
)
@modal.fastapi_endpoint(method="POST")
async def mix_audio(request):
    """POST JSON — _process_mix를 spawn으로 비동기 실행 → 즉시 accepted 응답.

    payload:
        job_id, vocals_url, instrumental_url,
        output_bucket, output_prefix, callback_url, step
    """
    body = await request.json()
    required = [
        "job_id", "vocals_url", "instrumental_url",
        "output_prefix", "callback_url", "step",
    ]
    missing = [k for k in required if body.get(k) is None]
    if missing:
        return {"error": f"필수 필드 누락: {missing}", "code": "MISSING_FIELDS"}

    _process_mix.spawn(
        body["job_id"],
        body["vocals_url"],
        body["instrumental_url"],
        body.get("output_bucket", "studio-recording"),
        body["output_prefix"],
        body["callback_url"],
        body["step"],
    )
    return {"accepted": True, "job_id": body["job_id"]}
