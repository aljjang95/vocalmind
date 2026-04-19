"""Studio 오케스트레이터 라우터 (Phase 0).

BFF에서 /orchestrator/start 호출 → 상태머신 드라이브.
Modal/Runware 콜백은 /orchestrator/callback/* 로 수신.

인증: X-Orchestrator-Secret 헤더 (내부 호출 전용).
"""
from __future__ import annotations

import logging
import os
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from pydantic import BaseModel

from services import studio_pipeline as pipeline
from services import modal_dispatcher
from services import moderation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/orchestrator", tags=["orchestrator"])


# ── 인증 가드 ──────────────────────────────────────────────────────

def _verify_secret(header_value: str | None) -> None:
    expected = os.environ.get("ORCHESTRATOR_SECRET")
    if not expected:
        raise HTTPException(status_code=500, detail="ORCHESTRATOR_SECRET 미설정")
    if header_value != expected:
        raise HTTPException(status_code=401, detail="인증 실패")


# ── 요청/응답 스키마 ────────────────────────────────────────────────

class StartJobRequest(BaseModel):
    job_id: str


class StartJobResponse(BaseModel):
    accepted: bool
    job_id: str
    status: str


class ModalCallbackRequest(BaseModel):
    job_id: str
    step: Literal[
        "vocal_separating", "vocal_rvc", "vocal_mixing",
        "composing", "formatting", "watermarking",
    ]
    status: Literal["success", "failed"]
    result: dict = {}
    error: str | None = None


class RunwareCallbackRequest(BaseModel):
    job_id: str
    task_id: str
    step: Literal["scene_image_gen", "scene_video_gen", "lipsync"]
    status: Literal["success", "failed"]
    scene_id: str | None = None
    result_url: str | None = None
    error: str | None = None


class CallbackResponse(BaseModel):
    accepted: bool
    next_step: str | None = None


class CancelJobRequest(BaseModel):
    job_id: str
    user_id: str  # BFF가 세션 검증 후 대리 전달. 본인 확인은 파이프라인 내부 소유권 체크.


class CancelJobResponse(BaseModel):
    ok: bool
    job_id: str
    previous_status: str
    status: str  # "refunded"


# ── 엔드포인트 ─────────────────────────────────────────────────────

@router.post("/start", response_model=StartJobResponse)
async def start_job(
    req: StartJobRequest,
    background: BackgroundTasks,
    x_orchestrator_secret: str | None = Header(default=None),
) -> StartJobResponse:
    """job 파이프라인 시작.

    BFF가 studio_jobs(pending) insert + 크레딧 차감 완료 후 호출.
    즉시 accepted 반환하고, BackgroundTask로 첫 단계(Demucs) dispatch.
    """
    _verify_secret(x_orchestrator_secret)

    job = pipeline.get_job(req.job_id)
    if job["status"] != "pending":
        # 재시작 요청이면 현재 상태 기준으로 복원 dispatch
        logger.info("job_id=%s 이미 진행 중 (status=%s)", req.job_id, job["status"])
        return StartJobResponse(
            accepted=True, job_id=req.job_id, status=job["status"],
        )

    # 낙관적 잠금: pending → vocal_separating
    result = pipeline.transition(
        req.job_id,
        expected_status="pending",
        next_status="vocal_separating",
        fields={"started_at": "now()"},
    )
    if not result.applied:
        # 동시 호출 — 이미 다른 워커가 전이시킴
        current = pipeline.get_job(req.job_id)
        return StartJobResponse(
            accepted=True, job_id=req.job_id, status=current["status"],
        )

    # Demucs dispatch (W2 후속에서 modal_dispatcher로 실제 spawn)
    background.add_task(_dispatch_vocal_separating, req.job_id)

    return StartJobResponse(
        accepted=True, job_id=req.job_id, status="vocal_separating",
    )


@router.post("/callback/modal", response_model=CallbackResponse)
async def modal_callback(
    req: ModalCallbackRequest,
    background: BackgroundTasks,
    x_orchestrator_secret: str | None = Header(default=None),
) -> CallbackResponse:
    """Modal 함수 완료 콜백 → 다음 단계 전이."""
    _verify_secret(x_orchestrator_secret)

    if req.status == "failed":
        attempts = pipeline.increment_attempt(req.job_id)
        job = pipeline.get_job(req.job_id)
        if attempts >= int(job["max_attempts"]):
            pipeline.mark_failed(req.job_id, failed_step=req.step, error=req.error or "unknown")
            return CallbackResponse(accepted=True, next_step="failed")
        # 재시도 — 같은 단계 재dispatch
        background.add_task(_redispatch_step, req.job_id, req.step)
        return CallbackResponse(accepted=True, next_step=req.step)

    # Stage 3 모더레이션 게이트 — watermarking 완료 시점에 결과물 검증.
    # 위반 시 mark_failed + 자동 환불 (moderation_events 로깅은 enforce 내부 처리).
    if req.step == "watermarking":
        gate = _stage3_moderation_gate(req.job_id, req.result)
        if gate is not None:
            return gate

    # 성공 — 다음 단계로 전이
    next_step = _next_step(req.step)
    if next_step is None:
        return CallbackResponse(accepted=True, next_step=None)

    result = pipeline.transition(
        req.job_id,
        expected_status=req.step,
        next_status=next_step,
        fields=_result_to_fields(req.step, req.result),
    )
    if result.applied:
        background.add_task(_dispatch_step, req.job_id, next_step)
    return CallbackResponse(accepted=True, next_step=next_step)


def _stage3_moderation_gate(job_id: str, result: dict) -> "CallbackResponse | None":
    """watermarking 완료 직후 Stage 3 검사. 위반 시 mark_failed + 환불.

    통과면 None 반환(기존 success 플로우 계속). 차단되면 CallbackResponse 반환.
    """
    try:
        job = pipeline.get_job(job_id)
    except pipeline.PipelineError:
        logger.exception("[moderation stage3] job 조회 실패 %s", job_id)
        return None

    scene_plan = job.get("scene_plan") or {}
    scenes = scene_plan.get("scenes") or []
    scene_prompts = [s.get("prompt", "") for s in scenes if isinstance(s, dict)]
    output_url = job.get("landscape_url") or result.get("landscape_path")
    duration_sec = scene_plan.get("total_duration_sec")
    if duration_sec is None:
        try:
            duration_sec = float(sum(s.get("duration_sec", 0) for s in scenes))
        except (TypeError, ValueError):
            duration_sec = None

    mod = moderation.check_cover_output(
        output_url=output_url,
        duration_sec=duration_sec,
        scene_prompts=scene_prompts,
    )
    moderation.log_events(job["user_id"], mod, job_id=job_id)

    if mod.decision == "block":
        categories = ",".join(sorted({e.category for e in mod.events})) or "unknown"
        pipeline.mark_failed(
            job_id,
            failed_step="watermarking",
            error=f"moderation block: {categories}",
        )
        return CallbackResponse(accepted=True, next_step="failed")

    return None


@router.post("/callback/runware", response_model=CallbackResponse)
async def runware_callback(
    req: RunwareCallbackRequest,
    background: BackgroundTasks,
    x_orchestrator_secret: str | None = Header(default=None),
) -> CallbackResponse:
    """Runware 비동기 태스크 완료 알림 (polling 또는 webhook).

    scene_image_gen / scene_video_gen 단계의 씬별 결과를 축적하고,
    모든 씬이 완료되면 다음 단계로 전이 + dispatch.
    """
    _verify_secret(x_orchestrator_secret)

    if req.status == "failed":
        attempts = pipeline.increment_attempt(req.job_id)
        job = pipeline.get_job(req.job_id)
        if attempts >= int(job["max_attempts"]):
            pipeline.mark_failed(req.job_id, failed_step=req.step, error=req.error or "unknown")
            return CallbackResponse(accepted=True, next_step="failed")
        logger.warning(
            "Runware task 실패 (attempt %d/%s) job_id=%s step=%s task_id=%s error=%s",
            attempts, job["max_attempts"], req.job_id, req.step, req.task_id, req.error,
        )
        return CallbackResponse(accepted=True, next_step=req.step)

    # 성공 — 씬 결과 URL 축적
    if req.scene_id and req.result_url:
        try:
            pipeline.update_scene_result(req.job_id, req.scene_id, req.step, req.result_url)
        except pipeline.PipelineError:
            logger.exception(
                "scene_result 업데이트 실패 job_id=%s scene_id=%s step=%s",
                req.job_id, req.scene_id, req.step,
            )
            return CallbackResponse(accepted=True, next_step=req.step)
    else:
        logger.warning(
            "Runware 콜백 scene_id 또는 result_url 누락 job_id=%s step=%s task_id=%s",
            req.job_id, req.step, req.task_id,
        )

    # 모든 씬 완료 여부 확인 → 다음 단계 전이
    try:
        if pipeline.all_scenes_done(req.job_id, req.step):
            next_step = _next_step(req.step)
            if next_step is None:
                return CallbackResponse(accepted=True, next_step=None)

            result = pipeline.transition(
                req.job_id,
                expected_status=req.step,
                next_status=next_step,
            )
            if result.applied:
                logger.info(
                    "모든 씬 완료 → %s 전이 job_id=%s", next_step, req.job_id,
                )
                background.add_task(_dispatch_step, req.job_id, next_step)
            return CallbackResponse(accepted=True, next_step=next_step)
    except pipeline.PipelineError:
        logger.exception(
            "all_scenes_done 체크 실패 job_id=%s step=%s", req.job_id, req.step,
        )

    return CallbackResponse(accepted=True, next_step=req.step)


@router.post("/cancel", response_model=CancelJobResponse)
async def cancel_job(
    req: CancelJobRequest,
    x_orchestrator_secret: str | None = Header(default=None),
) -> CancelJobResponse:
    """유저 요청 취소 — cancellable 단계에서만 허용. mark_failed + 환불."""
    _verify_secret(x_orchestrator_secret)

    try:
        result = pipeline.cancel_job(req.job_id, req.user_id)
    except pipeline.NotCancellableError as e:
        raise HTTPException(
            status_code=409,
            detail={"error": str(e), "code": e.code, "current_status": e.current_status},
        )
    except pipeline.PipelineError as e:
        status = 404 if e.code == "NOT_FOUND" else 403 if e.code == "FORBIDDEN" else 500
        raise HTTPException(status_code=status, detail={"error": str(e), "code": e.code})

    return CancelJobResponse(
        ok=True,
        job_id=result["job_id"],
        previous_status=result["previous_status"],
        status=result["status"],
    )


# ── 내부 헬퍼 (실제 Modal/Runware spawn은 W2 후속에서) ─────────────

def _next_step(current: str) -> str | None:
    """STEP_ORDER에서 다음 단계 반환."""
    try:
        idx = pipeline.STEP_ORDER.index(current)  # type: ignore[arg-type]
    except ValueError:
        return None
    if idx + 1 >= len(pipeline.STEP_ORDER):
        return None
    return pipeline.STEP_ORDER[idx + 1]


def _result_to_fields(step: str, result: dict) -> dict:
    """Modal 결과 dict → studio_jobs 컬럼 매핑.

    composing: compose_final 콜백이 landscape/portrait/thumbnail/c2pa 전부 반환.
               formatting/watermarking은 auto-transition이므로 여기서 처리하지 않음.
    """
    mapping = {
        "vocal_separating": {
            "vocals_path": result.get("vocals_path"),
            "instrumental_path": result.get("instrumental_path"),
        },
        "vocal_rvc": {"converted_vocals_path": result.get("converted_vocals_path")},
        "vocal_mixing": {"final_vocal_mix_path": result.get("final_vocal_mix_path")},
        "composing": {
            "landscape_url": result.get("landscape_path"),
            "portrait_url": result.get("portrait_path"),
            "thumbnail_url": result.get("thumbnail_path"),
            "c2pa_signed": result.get("c2pa_signed", False),
        },
    }
    fields = mapping.get(step, {})
    return {k: v for k, v in fields.items() if v is not None}


def _signed_url(storage_path: str, ttl_sec: int = 3600) -> str | None:
    """Supabase Storage signed URL 발급. 실패 시 None."""
    import os
    import httpx
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key or not storage_path:
        return None
    bucket, _, path = storage_path.partition("/")
    if not path:
        return None
    try:
        with httpx.Client(timeout=10.0) as c:
            r = c.post(
                f"{url}/storage/v1/object/sign/{bucket}/{path}",
                headers={
                    "apikey": key,
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={"expiresIn": ttl_sec},
            )
            r.raise_for_status()
            data = r.json()
            return f"{url}/storage/v1{data['signedURL']}"
    except Exception as e:
        logger.warning("signed URL 발급 실패 (%s): %s", storage_path, e)
        return None


def _probe_duration(signed_url: str) -> float:
    """ffprobe로 미디어 duration(sec) 조회. 실패 시 60.0 기본값."""
    import subprocess
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                signed_url,
            ],
            capture_output=True, text=True, timeout=20,
        )
        val = (out.stdout or "").strip()
        if val:
            return max(10.0, float(val))
    except Exception as e:
        logger.warning("ffprobe 실패 — 기본 60s 사용: %s", e)
    return 60.0


def _dispatch_vocal_separating(job_id: str) -> None:
    """Demucs dispatch — raw_recording_path로 분리 시작."""
    try:
        job = pipeline.get_job(job_id)
        input_url = _signed_url(job["raw_recording_path"])
        if not input_url:
            pipeline.mark_failed(job_id, "vocal_separating", "signed URL 발급 실패")
            return
        output_prefix = f"{job['user_id']}/{job_id}"
        modal_dispatcher.dispatch_demucs(job_id, input_url, output_prefix)
    except modal_dispatcher.DispatchError as e:
        logger.exception("demucs dispatch 실패: %s", e)
        attempts = pipeline.increment_attempt(job_id)
        job = pipeline.get_job(job_id)
        if attempts >= int(job["max_attempts"]):
            logger.error(
                "demucs dispatch max_attempts(%d) 초과 → mark_failed job_id=%s",
                attempts, job_id,
            )
            pipeline.mark_failed(job_id, failed_step="vocal_separating", error=str(e))
        else:
            logger.warning(
                "demucs dispatch 실패 (attempt %d/%s) — /start 재호출로 재시도 가능 job_id=%s",
                attempts, job["max_attempts"], job_id,
            )


def _dispatch_step(job_id: str, step: str) -> None:
    """단계별 dispatch. 단계가 Modal/Runware 종류인지 판단해 분기."""
    try:
        job = pipeline.get_job(job_id)
    except pipeline.PipelineError:
        logger.exception("job 조회 실패 job_id=%s", job_id)
        return

    try:
        if step == "vocal_rvc":
            vocals_url = _signed_url(job.get("vocals_path", ""))
            if not vocals_url or not job.get("voice_identity_id"):
                pipeline.mark_failed(job_id, step, "RVC 입력 누락")
                return
            output_prefix = f"{job['user_id']}/{job_id}"
            modal_dispatcher.dispatch_rvc(
                job_id, vocals_url, job["voice_identity_id"], output_prefix,
            )

        elif step == "scene_planning":
            # scene_dispatcher가 plan→image→video까지 일괄 처리 후 lipsync로 전이.
            # run_scene_pipeline은 동기이지만 BackgroundTasks 스레드풀에서 실행됨.
            from services import scene_dispatcher
            from infra import runware_catalog as cat

            mix_url = _signed_url(job.get("final_vocal_mix_path", ""))
            duration = _probe_duration(mix_url) if mix_url else 60.0
            # job.quality_tier 검증 — 없거나 잘못된 값이면 기본 tier로 폴백
            try:
                tier = cat.validate_tier(job.get("quality_tier") or cat.DEFAULT_TIER)
            except ValueError:
                logger.warning(
                    "잘못된 quality_tier=%r → DEFAULT_TIER로 폴백",
                    job.get("quality_tier"),
                )
                tier = cat.DEFAULT_TIER
            scene_dispatcher.run_scene_pipeline(
                job_id=job_id,
                style_preset=job["style_preset"],
                duration_sec=duration,
                tier=tier,
            )
            # run_scene_pipeline이 lipsync로 전이했으면 바로 이어서 dispatch
            post = pipeline.get_job(job_id)
            if post["status"] == "lipsync":
                _dispatch_step(job_id, "lipsync")

        elif step == "lipsync":
            # Phase 0: 실제 LatentSync 생략 — scene 비디오를 그대로 composing으로 넘김.
            # (avatar_mode=faceless에서는 lipsync 불필요. 다른 모드는 W4에서 확장.)
            result = pipeline.transition(
                job_id, expected_status="lipsync", next_status="composing",
            )
            if result.applied:
                _dispatch_step(job_id, "composing")

        elif step == "vocal_mixing":
            vocals_url = _signed_url(job.get("converted_vocals_path", ""))
            instrumental_url = _signed_url(job.get("instrumental_path", ""))
            if not vocals_url or not instrumental_url:
                pipeline.mark_failed(job_id, step, "vocal_mixing 입력 누락")
                return
            output_prefix = f"{job['user_id']}/{job_id}"
            modal_dispatcher.dispatch_mix(
                job_id, vocals_url, instrumental_url, output_prefix,
            )

        elif step == "composing":
            scene_plan = job.get("scene_plan") or {}
            scenes = scene_plan.get("scenes", [])
            scene_urls = [s.get("videoUrl") or s.get("video_url") for s in scenes]
            scene_urls = [u for u in scene_urls if u]
            mix_url = _signed_url(job.get("final_vocal_mix_path", ""))
            if not scene_urls or not mix_url:
                pipeline.mark_failed(job_id, step, "composing 입력 누락")
                return
            output_prefix = f"{job['user_id']}/{job_id}"
            modal_dispatcher.dispatch_compose(
                job_id=job_id,
                scene_video_urls=scene_urls,
                final_vocal_mix_url=mix_url,
                output_prefix=output_prefix,
            )

        elif step == "formatting":
            # compose_final이 이미 landscape/portrait 모두 처리했음 → 즉시 watermarking 전이
            result = pipeline.transition(
                job_id, expected_status="formatting", next_status="watermarking",
            )
            if result.applied:
                _dispatch_step(job_id, "watermarking")

        elif step == "watermarking":
            # Stage 3 모더레이션 게이트 + 즉시 finalizing 전이
            gate = _stage3_moderation_gate(job_id, {})
            if gate is not None:
                return  # mark_failed already called inside
            result = pipeline.transition(
                job_id, expected_status="watermarking", next_status="finalizing",
            )
            if result.applied:
                _dispatch_step(job_id, "finalizing")

        elif step == "finalizing":
            _finalize_job(job_id)

        else:
            logger.info("[todo] dispatch step=%s for job_id=%s", step, job_id)

    except modal_dispatcher.DispatchError as e:
        logger.exception("dispatch 실패 step=%s: %s", step, e)
        pipeline.increment_attempt(job_id)


def _finalize_job(job_id: str) -> None:
    """covers 레코드 생성 + completed 전이.

    landscape_url / portrait_url / thumbnail_url 세 필드가 모두 있어야 진행.
    """
    import httpx

    try:
        job = pipeline.get_job(job_id)
    except pipeline.PipelineError:
        logger.exception("finalize: job 조회 실패 %s", job_id)
        return

    landscape = job.get("landscape_url")
    portrait = job.get("portrait_url")
    thumbnail = job.get("thumbnail_url")
    if not landscape or not portrait or not thumbnail:
        pipeline.mark_failed(job_id, "finalizing", "최종 URL 누락")
        return

    # covers 테이블 UPSERT (job_id unique index 기준)
    sb_url = pipeline._sb_url()
    cover_data = {
        "user_id": job["user_id"],
        "job_id": job_id,
        "title": job.get("title") or "AI Cover",
        "landscape_url": landscape,
        "portrait_url": portrait,
        "thumbnail_url": thumbnail,
        "duration_sec": job.get("duration_sec") or 30.0,
        "sns_uploadable": False,
    }
    headers = {
        **pipeline._sb_headers(),
        "Prefer": "resolution=merge-duplicates,return=representation",
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                f"{sb_url}/rest/v1/covers",
                json=cover_data,
                headers=headers,
            )
            if resp.status_code >= 400:
                logger.error(
                    "covers insert 실패 (%d): %s", resp.status_code, resp.text[:200],
                )
                pipeline.mark_failed(
                    job_id, "finalizing",
                    f"covers insert 실패: {resp.text[:200]}",
                )
                return
    except Exception as e:
        logger.exception("covers insert 예외: %s", e)
        pipeline.mark_failed(job_id, "finalizing", str(e))
        return

    # completed 전이
    result = pipeline.transition(
        job_id,
        expected_status="finalizing",
        next_status="completed",
        fields={"completed_at": "now()"},
    )
    if result.applied:
        logger.info("job 완료 job_id=%s", job_id)


def _redispatch_step(job_id: str, step: str) -> None:
    """재시도 dispatch — 동일 함수 재호출."""
    if step == "vocal_separating":
        _dispatch_vocal_separating(job_id)
    else:
        _dispatch_step(job_id, step)
