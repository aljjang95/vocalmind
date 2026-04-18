"""성구전환 분석기 — F0 점프/무성구간/smoothness (성구전환 긴장 지표)."""
from __future__ import annotations
import math
import numpy as np
import parselmouth
from parselmouth.praat import call
from models.tension import RegisterTransition
from analyzers.utils import safe


def analyze_register_transition(snd: parselmouth.Sound) -> RegisterTransition:
    """F0 프레임간 차이로 성구전환 및 무성구간을 분석한다."""
    pitch = call(snd, "To Pitch", 0.0, 75, 600)
    n_frames = call(pitch, "Get number of frames")
    dt = call(pitch, "Get time step")

    f0_frames = _extract_f0_frames(pitch, n_frames)

    if not f0_frames:
        return _empty_transition()

    max_jump, f0_jumps = _compute_f0_jumps(f0_frames)
    voiceless_gaps = _count_voiceless_gaps(f0_frames, dt)

    # transition_detected: 15Hz 이상 점프
    transition_detected = max_jump >= 15.0

    # HNR at transition (단순화: 전체 HNR 최솟값)
    harmonicity = call(snd, "To Harmonicity (cc)", 0.01, 75, 0.1, 1.0)
    hnr_min = safe(call(harmonicity, "Get minimum", 0, 0, "Parabolic"), 0.0)

    smoothness_score = _compute_smoothness(f0_jumps, voiceless_gaps)

    return RegisterTransition(
        transition_detected=transition_detected,
        f0_max_jump_hz=max_jump,
        hnr_min_at_transition=hnr_min,
        voiceless_gaps=voiceless_gaps,
        smoothness_score=smoothness_score,
    )


def _extract_f0_frames(pitch: object, n_frames: int) -> list[float]:
    """프레임별 F0 값 추출 — unvoiced는 0.0."""
    frames: list[float] = []
    for i in range(1, n_frames + 1):
        t = call(pitch, "Get time from frame number", i)
        val = call(pitch, "Get value at time", t, "Hertz", "Linear")
        if val != val or math.isinf(val) or val <= 0:
            frames.append(0.0)
        else:
            frames.append(val)
    return frames


def _compute_f0_jumps(f0_frames: list[float]) -> tuple[float, list[float]]:
    """연속 voiced 프레임 간 F0 점프 계산 — (max_jump, 전체 jumps)."""
    voiced_prev = 0.0
    max_jump = 0.0
    jumps: list[float] = []
    for f0 in f0_frames:
        if voiced_prev > 0 and f0 > 0:
            jump = abs(f0 - voiced_prev)
            jumps.append(jump)
            if jump > max_jump:
                max_jump = jump
        if f0 > 0:
            voiced_prev = f0
    return max_jump, jumps


def _count_voiceless_gaps(f0_frames: list[float], dt: float) -> int:
    """10ms 이상 연속 unvoiced 구간 개수 — trailing gap 포함."""
    frames_for_10ms = max(1, int(0.01 / dt)) if dt > 0 else 1
    gaps = 0
    consecutive = 0
    for f0 in f0_frames:
        if f0 == 0.0:
            consecutive += 1
        else:
            if consecutive >= frames_for_10ms:
                gaps += 1
            consecutive = 0
    if consecutive >= frames_for_10ms:
        gaps += 1
    return gaps


def _compute_smoothness(f0_jumps: list[float], voiceless_gaps: int) -> float:
    """F0 점프 페널티 60% + gap 페널티 40% → smoothness (0~1)."""
    if f0_jumps:
        avg_jump = float(np.mean(f0_jumps))
        jump_penalty = min(avg_jump / 200.0, 1.0)
    else:
        jump_penalty = 0.0
    gap_penalty = min(voiceless_gaps / 5.0, 1.0)
    score = float(1.0 - (0.6 * jump_penalty + 0.4 * gap_penalty))
    return max(0.0, min(1.0, score))


def _empty_transition() -> RegisterTransition:
    return RegisterTransition(
        transition_detected=False,
        f0_max_jump_hz=0.0,
        hnr_min_at_transition=0.0,
        voiceless_gaps=0,
        smoothness_score=1.0,
    )
