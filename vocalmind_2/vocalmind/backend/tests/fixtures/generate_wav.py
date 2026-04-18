"""테스트용 합성 WAV 파일 생성."""
from __future__ import annotations
import numpy as np
import soundfile as sf

def generate_stable_tone(path: str, freq: float = 220.0, duration: float = 2.0, sr: int = 16000) -> str:
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    signal = (0.5 * np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * 2 * freq * t) +
              0.12 * np.sin(2 * np.pi * 3 * freq * t) + 0.06 * np.sin(2 * np.pi * 4 * freq * t))
    signal = signal / np.max(np.abs(signal)) * 0.8
    sf.write(path, signal.astype(np.float32), sr)
    return path

def generate_tense_tone(path: str, freq: float = 220.0, duration: float = 2.0, sr: int = 16000) -> str:
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    phase_jitter = np.cumsum(np.random.normal(0, 0.05, len(t)))
    amp_shimmer = 1.0 + np.random.normal(0, 0.15, len(t))
    signal = amp_shimmer * (0.5 * np.sin(2 * np.pi * freq * t + phase_jitter) +
              0.3 * np.sin(2 * np.pi * 2 * freq * t + phase_jitter * 1.5) +
              0.15 * np.sin(2 * np.pi * 3 * freq * t))
    noise = np.random.normal(0, 0.15, len(t))
    signal = signal + noise
    signal = signal / np.max(np.abs(signal)) * 0.8
    sf.write(path, signal.astype(np.float32), sr)
    return path

def generate_register_break(path: str, sr: int = 16000) -> str:
    t_low = np.linspace(0, 1.0, int(sr * 1.0), endpoint=False)
    t_gap = np.zeros(int(sr * 0.03))
    t_high = np.linspace(0, 1.0, int(sr * 1.0), endpoint=False)
    low = 0.5 * np.sin(2 * np.pi * 150 * t_low) + 0.25 * np.sin(2 * np.pi * 300 * t_low)
    high = 0.5 * np.sin(2 * np.pi * 350 * t_high) + 0.25 * np.sin(2 * np.pi * 700 * t_high)
    signal = np.concatenate([low, t_gap, high])
    signal = signal / np.max(np.abs(signal)) * 0.8
    sf.write(path, signal.astype(np.float32), sr)
    return path

def generate_smooth_transition(path: str, sr: int = 16000) -> str:
    duration = 2.0
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    freq = 150 + (350 - 150) * (t / duration) ** 1.5
    phase = np.cumsum(2 * np.pi * freq / sr)
    signal = 0.5 * np.sin(phase) + 0.25 * np.sin(2 * phase)
    signal = signal / np.max(np.abs(signal)) * 0.8
    sf.write(path, signal.astype(np.float32), sr)
    return path
