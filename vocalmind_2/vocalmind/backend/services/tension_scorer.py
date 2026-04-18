"""긴장 측정 데이터 → 종합 긴장 점수 계산."""
from __future__ import annotations
from models.tension import TensionAnalysis, TensionScore

def _normalize(value: float, low: float, high: float) -> float:
    if high <= low:
        return 0.0
    return max(0.0, min(1.0, (value - low) / (high - low)))

def calculate_tension_score(analysis: TensionAnalysis) -> TensionScore:
    vq = analysis.voice_quality
    fm = analysis.formant
    rg = analysis.register_transition

    # 후두 긴장
    laryngeal = (
        _normalize(vq.jitter_local, 0.5, 3.0) * 0.25
        + _normalize(vq.shimmer_local, 2.0, 10.0) * 0.25
        + (1.0 - _normalize(vq.hnr, 10.0, 25.0)) * 0.30
        + _normalize(-vq.h1_h2, -2.0, 5.0) * 0.20
    ) * 100

    # 혀뿌리 긴장
    tongue_root = (
        _normalize(fm.f1_mean, 550, 700) * 0.6
        + _normalize(-vq.h1_h2, -2.0, 5.0) * 0.4
    ) * 100

    # 턱 긴장
    jaw = (1.0 - _normalize(fm.f1_std, 10, 60)) * 100

    # 성구전환 끊김
    register_break = (
        _normalize(rg.f0_max_jump_hz, 10, 50) * 0.35
        + (1.0 - _normalize(rg.hnr_min_at_transition, 5, 20)) * 0.30
        + min(1.0, rg.voiceless_gaps * 0.4) * 0.20
        + (1.0 - rg.smoothness_score) * 0.15
    ) * 100

    overall = laryngeal * 0.30 + tongue_root * 0.25 + jaw * 0.15 + register_break * 0.30
    overall = max(0.0, min(100.0, overall))
    tension_detected = overall > 40

    parts = []
    if laryngeal > 50:
        parts.append("후두 긴장")
    if tongue_root > 50:
        parts.append("혀뿌리 긴장")
    if jaw > 50:
        parts.append("턱 긴장")
    if register_break > 50:
        parts.append("성구전환 끊김")
    detail = ", ".join(parts) if parts else "이완 상태"

    return TensionScore(
        overall=round(overall, 1), laryngeal_tension=round(laryngeal, 1),
        tongue_root_tension=round(tongue_root, 1), jaw_tension=round(jaw, 1),
        register_break=round(register_break, 1), tension_detected=tension_detected, detail=detail,
    )
