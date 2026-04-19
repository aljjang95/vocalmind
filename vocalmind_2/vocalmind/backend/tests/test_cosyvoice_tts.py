"""cosyvoice_tts 회귀 방지 — prefix noise 버그(2026-04-19) 재발 차단.

참조 클립과 transcript가 why_audio_server의 검증된 클린 세팅과 동일한지 고정.
"""
from __future__ import annotations

from services import cosyvoice_tts


def test_ref_wav_points_to_clean_version():
    """noisy 원본(`hlb_master_ref.wav`) 대신 클린 10.1s 버전 사용."""
    assert cosyvoice_tts._REF_WAV.name == "hlb_master_ref_clean.wav", (
        "ICL prefix noise 재발 방지: hlb_master_ref.wav(noisy 20s) 금지, "
        "hlb_master_ref_clean.wav(10.1s) 사용 필수"
    )


def test_ref_wav_file_exists():
    """참조 클립이 실제로 존재해야 런타임 RuntimeError 방지."""
    assert cosyvoice_tts._REF_WAV.exists(), (
        f"참조 클립 누락: {cosyvoice_tts._REF_WAV}. "
        "backend/assets/hlb_master_ref_clean.wav가 배포 이미지에 포함돼야 함"
    )


def test_transcript_matches_clean_clip_length():
    """transcript가 10.1s 클린 클립과 정렬돼야 prefix noise 없음.

    클린 클립이 끝나는 지점인 '방법은'에서 transcript도 끝나야 ICL 정렬이 맞음.
    긴 transcript를 짧은 참조 클립에 쓰면 합성 시작부에 잔향 리크.
    """
    assert cosyvoice_tts._REF_TRANSCRIPT.endswith("방법은"), (
        f"transcript 끝: ...{cosyvoice_tts._REF_TRANSCRIPT[-30:]!r}. "
        "'방법은'으로 끝나야 클린 클립(10.1s)과 정렬됨."
    )
    assert "아무것도 안 할 때" not in cosyvoice_tts._REF_TRANSCRIPT, (
        "긴 원본 transcript 잔재 감지 — 클린 참조 클립에는 이 구간이 없음"
    )
