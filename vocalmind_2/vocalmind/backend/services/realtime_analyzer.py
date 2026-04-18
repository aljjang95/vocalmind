"""실시간 오디오 청크 분석 + 템플릿 감각 피드백."""
from __future__ import annotations
import subprocess
import uuid
from dataclasses import dataclass, field
from pathlib import Path
import services.tension_analyzer as tension_analyzer
import services.tension_scorer as tension_scorer
from models.tension import TensionScore
from core.pitch_extractor import extract_avg_pitch as _extract_avg_pitch_core


# ── 감각 피드백 템플릿 (Claude 호출 없이 즉시 응답) ──────────────────────────

_SOMATIC_TEMPLATES: dict[str, list[str]] = {
    "후두 긴장": [
        "목 앞쪽이 당기는 느낌이 있나요? 하품할 때처럼 목 안쪽이 시원해지는 감각을 찾아보세요.",
        "소리가 목에서 걸리는 느낌이라면, 숨을 내쉬면서 '후~' 하고 놓아보세요.",
        "목이 조이는 느낌이 있다면 턱을 살짝 내려놓고, 혀끝이 아랫니 뒤에 닿는 감각을 느껴보세요.",
    ],
    "혀뿌리 긴장": [
        "혀 뒤쪽이 뻣뻣한 느낌인가요? '냐~' 소리를 내면서 혀가 앞으로 나오는 감각을 느껴보세요.",
        "혀뿌리가 당기면 공간이 좁아져요. '앙~' 하면서 입 안이 넓어지는 느낌을 찾아보세요.",
        "혀 아래쪽에 공간이 느껴지나요? 그 공간을 유지하면서 소리를 내보세요.",
    ],
    "턱 긴장": [
        "턱이 닫히면서 소리가 막히는 느낌인가요? 턱을 손가락 하나 들어갈 만큼만 열어보세요.",
        "턱에 힘이 들어가 있다면, 입을 벌린 채 '아~' 하면서 턱이 무겁게 늘어지는 감각을 느껴보세요.",
        "턱관절 옆을 살짝 만져보세요. 딱딱한가요? 부드러워질 때까지 천천히 '마~' 해보세요.",
    ],
    "성구전환 끊김": [
        "소리가 뚝 끊기는 지점이 있나요? 그 부분에서 숨의 양을 줄이면서 부드럽게 넘어가보세요.",
        "높은 음으로 갈 때 힘이 확 들어가면 끊겨요. 올라갈수록 오히려 가볍게 놓아보세요.",
        "전환 구간에서 '음~' 허밍으로 먼저 연결해보고, 그 감각을 유지하면서 발음을 얹어보세요.",
    ],
    "이완 상태": [
        "좋아요! 지금 편안한 감각을 기억해두세요. 이게 좋은 세팅이에요.",
        "안정적이에요. 지금 배 아래쪽에 느껴지는 압력감, 그게 바로 지지예요.",
        "잘하고 있어요. 지금 느끼는 목의 시원함, 그 감각을 유지해보세요.",
    ],
}


def get_somatic_feedback(tension_score: TensionScore, chunk_index: int) -> str:
    """긴장 점수 기반 감각 피드백 템플릿 선택 (Claude 호출 없음)."""
    if not tension_score.tension_detected:
        templates = _SOMATIC_TEMPLATES["이완 상태"]
    else:
        # 가장 높은 긴장 부위 선택
        parts = {
            "후두 긴장": tension_score.laryngeal_tension,
            "혀뿌리 긴장": tension_score.tongue_root_tension,
            "턱 긴장": tension_score.jaw_tension,
            "성구전환 끊김": tension_score.register_break,
        }
        top_part = max(parts, key=parts.get)  # type: ignore[arg-type]
        templates = _SOMATIC_TEMPLATES.get(top_part, _SOMATIC_TEMPLATES["이완 상태"])
    return templates[chunk_index % len(templates)]


# ── 오디오 청크 분석 ─────────────────────────────────────────────────────────

def convert_chunk_to_wav(chunk_data: bytes, tmp_dir: Path) -> Path:
    """WebM 청크를 16kHz mono WAV로 변환."""
    src = tmp_dir / f"{uuid.uuid4().hex}.webm"
    dst = tmp_dir / f"{uuid.uuid4().hex}.wav"
    src.write_bytes(chunk_data)
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(src), "-ar", "16000", "-ac", "1", str(dst)],
        capture_output=True, encoding="utf-8", errors="replace",
        timeout=10, check=True,
    )
    src.unlink(missing_ok=True)
    return dst


def extract_avg_pitch(wav_path: Path) -> float:
    """WAV 파일에서 평균 피치(Hz)를 추출한다. 실패 시 0.0 반환.

    core.pitch_extractor로 위임 (중복 제거).
    """
    return _extract_avg_pitch_core(wav_path)


def analyze_chunk(wav_path: Path) -> TensionScore | None:
    """WAV 청크를 분석하여 긴장 점수 반환."""
    try:
        analysis = tension_analyzer.analyze_tension(str(wav_path))
        return tension_scorer.calculate_tension_score(analysis)
    except Exception:
        return None


# ── 세션 누적 데이터 ─────────────────────────────────────────────────────────

@dataclass
class SessionAccumulator:
    """세션 동안의 분석 결과를 누적 관리."""
    stage_id: int = 0
    scores: list[TensionScore] = field(default_factory=list)
    chunk_count: int = 0
    feedbacks: list[str] = field(default_factory=list)
    pitches: list[float] = field(default_factory=list)

    def add(self, score: TensionScore, feedback: str, pitch: float = 0.0) -> None:
        self.scores.append(score)
        self.feedbacks.append(feedback)
        # 0Hz(무성)는 의미 있는 피치가 아님 → 기록하지 않음
        if pitch and pitch > 0:
            self.pitches.append(float(pitch))
        self.chunk_count += 1

    def summary_stats(self) -> dict:
        """세션 통계 요약."""
        if not self.scores:
            return {
                "chunk_count": 0,
                "avg_tension": 0,
                "max_tension": 0,
                "min_tension": 0,
                "tension_events": 0,
                "main_issues": [],
                "pitch_history": [],
                "voiced_ratio": 0.0,
            }
        overalls = [s.overall for s in self.scores]
        voiced_ratio = len(self.pitches) / self.chunk_count if self.chunk_count > 0 else 0.0
        return {
            "chunk_count": self.chunk_count,
            "avg_tension": round(sum(overalls) / len(overalls), 1),
            "max_tension": round(max(overalls), 1),
            "min_tension": round(min(overalls), 1),
            "tension_events": sum(1 for s in self.scores if s.tension_detected),
            "main_issues": self._main_issues(),
            "pitch_history": [round(p, 2) for p in self.pitches],
            "voiced_ratio": round(voiced_ratio, 3),
        }

    def _main_issues(self) -> list[str]:
        """세션 전체에서 가장 빈번한 긴장 부위."""
        counts: dict[str, int] = {}
        for s in self.scores:
            if s.laryngeal_tension > 50:
                counts["후두"] = counts.get("후두", 0) + 1
            if s.tongue_root_tension > 50:
                counts["혀뿌리"] = counts.get("혀뿌리", 0) + 1
            if s.jaw_tension > 50:
                counts["턱"] = counts.get("턱", 0) + 1
            if s.register_break > 50:
                counts["성구전환"] = counts.get("성구전환", 0) + 1
        return sorted(counts, key=counts.get, reverse=True)[:3]  # type: ignore[arg-type]
