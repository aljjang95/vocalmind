"""parselmouth 기반 음성 분석 서비스."""
from __future__ import annotations
import numpy as np
import soundfile as sf
import parselmouth
import services.tension_analyzer as tension_analyzer
import services.tension_scorer as tension_scorer
from models.tension import TensionScore


def analyze_audio_file(audio_path: str) -> dict:
    """WAV 파일 분석 → {pitch_values, avg_pitch, tone_stability, duration, tension_score}"""
    data, sr = sf.read(audio_path, dtype="float32", always_2d=False)
    if data.ndim == 2:
        data = data.mean(axis=1)
    duration = len(data) / sr
    snd = parselmouth.Sound(data.astype(np.float64), sampling_frequency=sr)
    try:
        pitch_obj = snd.to_pitch()
    except parselmouth.PraatError:
        return {"pitch_values": [], "avg_pitch": 0.0, "tone_stability": 0.0, "duration": duration, "tension_score": None}
    values = pitch_obj.selected_array["frequency"]
    voiced = values[values > 0]
    if len(voiced) == 0:
        return {"pitch_values": [], "avg_pitch": 0.0, "tone_stability": 0.0, "duration": duration, "tension_score": None}
    avg_pitch = float(np.mean(voiced))
    std_pitch = float(np.std(voiced))
    tone_stability = max(0.0, min(100.0, 100.0 - (std_pitch / avg_pitch * 200)))

    t_score: TensionScore | None = None
    try:
        analysis = tension_analyzer.analyze_tension(audio_path)
        t_score = tension_scorer.calculate_tension_score(analysis)
    except Exception:
        t_score = None

    return {
        "pitch_values": voiced.tolist(),
        "avg_pitch": avg_pitch,
        "tone_stability": tone_stability,
        "duration": duration,
        "tension_score": t_score,
    }
