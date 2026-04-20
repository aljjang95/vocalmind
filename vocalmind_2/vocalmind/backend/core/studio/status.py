"""Studio job 상태 순서/진행률/레이블. 순수 상수·함수만."""
from __future__ import annotations

from domain_types.studio import JobStatus

STEP_ORDER: list[JobStatus] = [
    "pending",
    "vocal_separating", "vocal_rvc", "vocal_mixing",
    "scene_planning", "scene_image_gen", "scene_video_gen",
    "lipsync", "composing", "formatting", "watermarking",
    "finalizing", "completed",
]

STEP_PROGRESS: dict[JobStatus, int] = {
    "pending": 0,
    "vocal_separating": 10,
    "vocal_rvc": 20,
    "vocal_mixing": 30,
    "scene_planning": 40,
    "scene_image_gen": 50,
    "scene_video_gen": 70,
    "lipsync": 85,
    "composing": 90,
    "formatting": 93,
    "watermarking": 96,
    "finalizing": 98,
    "completed": 100,
}

STEP_LABEL: dict[JobStatus, str] = {
    "pending": "대기 중",
    "vocal_separating": "보컬과 반주를 분리하고 있어요",
    "vocal_rvc": "본인 음색으로 보컬을 변환하고 있어요",
    "vocal_mixing": "보컬과 반주를 섞고 있어요",
    "scene_planning": "뮤직비디오 장면을 설계하고 있어요",
    "scene_image_gen": "장면 이미지를 그리고 있어요",
    "scene_video_gen": "이미지를 영상으로 움직이게 하고 있어요",
    "lipsync": "립싱크를 맞추고 있어요",
    "composing": "영상을 합성하고 있어요",
    "formatting": "가로·세로 두 포맷으로 렌더링하고 있어요",
    "watermarking": "AI 생성물 서명을 추가하고 있어요",
    "finalizing": "마무리하고 있어요",
    "completed": "완성했어요",
    "failed": "작업이 실패했어요",
    "refunded": "크레딧을 환불했어요",
}


def next_status(current: JobStatus) -> JobStatus | None:
    """STEP_ORDER에서 다음 단계. 마지막이면 None."""
    try:
        idx = STEP_ORDER.index(current)
    except ValueError:
        return None
    if idx + 1 >= len(STEP_ORDER):
        return None
    return STEP_ORDER[idx + 1]
