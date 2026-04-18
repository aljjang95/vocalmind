"""성구전환 분석 테스트 — 매끄러운 전환 vs 끊기는 전환."""
from __future__ import annotations
import pytest
from tests.fixtures.generate_wav import generate_register_break, generate_smooth_transition
from services.tension_analyzer import analyze_tension

@pytest.fixture
def break_wav(tmp_path):
    return generate_register_break(str(tmp_path / "break.wav"))

@pytest.fixture
def smooth_wav(tmp_path):
    return generate_smooth_transition(str(tmp_path / "smooth.wav"))

class TestRegisterTransition:
    def test_break_has_voiceless_gap(self, break_wav):
        result = analyze_tension(break_wav)
        assert result.register_transition.voiceless_gaps >= 1

    def test_smooth_no_voiceless_gap(self, smooth_wav):
        result = analyze_tension(smooth_wav)
        assert result.register_transition.voiceless_gaps == 0

    def test_break_larger_f0_jump(self, break_wav, smooth_wav):
        br = analyze_tension(break_wav)
        sm = analyze_tension(smooth_wav)
        assert br.register_transition.f0_max_jump_hz > sm.register_transition.f0_max_jump_hz

    def test_smooth_higher_smoothness(self, break_wav, smooth_wav):
        br = analyze_tension(break_wav)
        sm = analyze_tension(smooth_wav)
        assert sm.register_transition.smoothness_score > br.register_transition.smoothness_score

    def test_break_transition_detected(self, break_wav):
        result = analyze_tension(break_wav)
        assert result.register_transition.transition_detected is True
