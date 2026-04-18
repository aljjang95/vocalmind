from __future__ import annotations

import logging as _logging
import os as _os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

_logger = _logging.getLogger(__name__)


def _check_phase0_env() -> list[str]:
    """Phase 0 Studio 파이프라인에 필요한 환경변수 검증 — 누락 리스트 반환."""
    required = {
        "ORCHESTRATOR_SECRET": "BFF ↔ orchestrator 콜백 인증",
        "SUPABASE_URL": "Storage signed URL + DB patch",
        "SUPABASE_SERVICE_ROLE_KEY": "studio_jobs/voice_identities service 쓰기",
        "ANTHROPIC_API_KEY": "scene_planner Claude Haiku",
        "RUNWARE_API_KEY": "FLUX + HunyuanVideo + LatentSync",
        "PUBLIC_BACKEND_URL": "Modal 콜백 대상 URL",
    }
    missing = [k for k in required if not _os.environ.get(k)]
    if missing:
        _logger.warning(
            "[Phase 0] 환경변수 누락 %s — 해당 기능 호출 시 실패할 수 있습니다. "
            "목적: %s",
            missing,
            {k: required[k] for k in missing},
        )
    return missing
from routers.evaluate import router as evaluate_router
from routers.coach import router as coach_router
from routers.ws_evaluate import router as ws_router
from routers.ws_scale import router as ws_scale_router
from routers.onboarding import router as onboarding_router
from routers.vocal_dna import router as vocal_dna_router
from routers.rhythm import router as rhythm_router
from routers.ws_rhythm import router as ws_rhythm_router
from routers.breath import router as breath_router
from routers.audition import router as audition_router
from routers.orchestrator import router as orchestrator_router

app = FastAPI(title="VocalMind AI Backend", version="0.1.0")

_allowed_origins = [
    "http://localhost:3010",
    *([_os.environ["FRONTEND_URL"]] if _os.environ.get("FRONTEND_URL") else []),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(evaluate_router)
app.include_router(coach_router)
app.include_router(ws_router)
app.include_router(ws_scale_router)
app.include_router(onboarding_router)
app.include_router(vocal_dna_router)
app.include_router(rhythm_router)
app.include_router(ws_rhythm_router)
app.include_router(breath_router)
app.include_router(audition_router)
app.include_router(orchestrator_router)


@app.on_event("startup")
async def _startup_env_check() -> None:
    _check_phase0_env()


@app.get("/health")
def health() -> dict[str, str | list[str]]:
    missing = _check_phase0_env()
    return {
        "status": "ok" if not missing else "degraded",
        "phase0_missing_env": missing,
    }
