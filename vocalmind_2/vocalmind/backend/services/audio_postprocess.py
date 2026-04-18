"""
AI 커버 후처리 파이프라인
보컬 이펙트 체인 + 다이나믹 전사 + 반주 믹싱 + LUFS 정규화

이펙트 순서 (iZotope/Sonarworks 2025 검증):
  노이즈게이트 → HPF → 보정 EQ → 컴프레서 → 디에서 → 창의적 EQ → 리버브 → 리미터
"""
import numpy as np
import soundfile as sf
from dataclasses import dataclass


def _to_mono(x: np.ndarray) -> np.ndarray:
    """다채널 오디오를 모노로 변환. 이미 모노면 그대로 반환."""
    if x.ndim == 1:
        return x
    if x.shape[0] < x.shape[1]:
        return x.mean(axis=0)
    return x.mean(axis=1)


@dataclass
class PostProcessPreset:
    """장르별 후처리 프리셋"""
    name: str
    # 노이즈 게이트
    gate_threshold_db: float = -30.0
    # EQ — 보정 (컴프 앞)
    eq_low_cut_hz: float = 80.0
    eq_mid_cut_hz: float = 300.0
    eq_mid_cut_db: float = -1.0
    eq_mid_cut_q: float = 1.5
    # 컴프레서
    comp_threshold_db: float = -18.0
    comp_ratio: float = 2.5
    comp_attack_ms: float = 15.0
    comp_release_ms: float = 80.0
    # EQ — 창의적 (컴프 뒤)
    eq_presence_hz: float = 3000.0
    eq_presence_db: float = 2.5
    eq_consonant_hz: float = 5000.0
    eq_consonant_db: float = 1.5
    eq_air_hz: float = 8000.0
    eq_air_db: float = 1.0
    # 리버브
    reverb_room_size: float = 0.15
    reverb_wet: float = 0.10       # AICoverGen 검증 기본값
    reverb_damping: float = 0.7    # Sonarworks 권장
    # LUFS
    vocal_lufs: float = -8.0
    instrumental_lufs: float = -20.0
    master_lufs: float = -11.0


PRESETS = {
    "default": PostProcessPreset(name="기본"),
    "hq_svc": PostProcessPreset(
        name="HQ-SVC",
        eq_low_cut_hz=100.0,
        eq_mid_cut_hz=250.0,
        eq_mid_cut_db=-2.0,
        eq_presence_db=4.0,
        eq_consonant_db=3.0,
        eq_air_db=2.0,
        reverb_wet=0.08,
        vocal_lufs=-12.0,         # 보컬 레벨 낮춰서 찢어짐 방지
        instrumental_lufs=-18.0,  # 반주 상대적 올림 → 자연스러운 밸런스
        master_lufs=-13.0,        # 마스터도 여유 확보
    ),
    "ballad": PostProcessPreset(
        name="발라드",
        reverb_room_size=0.35,
        reverb_wet=0.15,
        reverb_damping=0.6,
        comp_ratio=2.0,
        eq_presence_db=1.5,
        eq_consonant_db=1.0,
        vocal_lufs=-10.0,
        instrumental_lufs=-19.0,
    ),
    "pop": PostProcessPreset(
        name="팝/댄스",
        reverb_room_size=0.15,
        reverb_wet=0.08,
        comp_ratio=3.0,
        eq_presence_db=3.0,
        eq_consonant_db=2.0,
        vocal_lufs=-9.0,
        instrumental_lufs=-18.0,
    ),
}


def process_vocal(audio: np.ndarray, sr: int, preset: PostProcessPreset = None) -> np.ndarray:
    """보컬에 이펙트 체인 적용

    순서 (iZotope/Sonarworks 2025):
      노이즈게이트 → HPF → 보정EQ → 컴프 → 디에서 → 창의적EQ → 리버브 → 리미터
    """
    from pedalboard import (
        Pedalboard, NoiseGate, HighpassFilter, PeakFilter,
        HighShelfFilter, Compressor, Reverb, Limiter
    )

    if preset is None:
        preset = PRESETS["default"]

    audio = audio.astype(np.float32)

    # 모노 → 스테레오 (리버브를 위해)
    if audio.ndim == 1:
        audio = np.stack([audio, audio], axis=0)
    elif audio.ndim == 2 and audio.shape[0] > audio.shape[1]:
        audio = audio.T

    board = Pedalboard([
        # 1. 노이즈 게이트 — 무음 구간 노이즈 차단 (Sonarworks 권장)
        NoiseGate(
            threshold_db=preset.gate_threshold_db,
            ratio=1.5,
            release_ms=250.0,
        ),
        # 2. HPF — 럼블/험 제거
        HighpassFilter(cutoff_frequency_hz=preset.eq_low_cut_hz),
        # 3. 보정 EQ — 머디 제거 (컴프 앞: 문제 주파수 먼저 제거)
        PeakFilter(
            cutoff_frequency_hz=preset.eq_mid_cut_hz,
            gain_db=preset.eq_mid_cut_db,
            q=preset.eq_mid_cut_q,
        ),
        # 4. 컴프레서 — 다이나믹 제어 (보정 EQ 후)
        Compressor(
            threshold_db=preset.comp_threshold_db,
            ratio=preset.comp_ratio,
            attack_ms=preset.comp_attack_ms,
            release_ms=preset.comp_release_ms,
        ),
        # 5. 디에서 — 치찰음 억제 (컴프가 증폭시킨 사이벌런스 처리)
        #    pedalboard에 De-esser 없음 → 7kHz 좁은 컷으로 대체
        PeakFilter(cutoff_frequency_hz=7000.0, gain_db=-3.0, q=2.0),
        # 6. 창의적 EQ — 존재감/자음/에어 (컴프 뒤: 색 입힘)
        PeakFilter(
            cutoff_frequency_hz=preset.eq_presence_hz,
            gain_db=preset.eq_presence_db,
            q=1.0,
        ),
        PeakFilter(
            cutoff_frequency_hz=preset.eq_consonant_hz,
            gain_db=preset.eq_consonant_db,
            q=1.5,
        ),
        HighShelfFilter(
            cutoff_frequency_hz=preset.eq_air_hz,
            gain_db=preset.eq_air_db,
        ),
        # 7. 리버브 (AICoverGen 검증값: wet=0.10, damping=0.7)
        Reverb(
            room_size=preset.reverb_room_size,
            wet_level=preset.reverb_wet,
            dry_level=1.0 - preset.reverb_wet,
            damping=preset.reverb_damping,
        ),
        # 8. 리미터 — 클리핑 방지 (무조건 마지막)
        Limiter(threshold_db=-1.0),
    ])

    processed = board(audio, sr)
    return processed


def normalize_lufs(audio: np.ndarray, sr: int, target_lufs: float) -> np.ndarray:
    """LUFS 기준으로 음량 정규화"""
    import pyloudnorm as pyln

    if audio.ndim == 2 and audio.shape[0] < audio.shape[1]:
        audio = audio.T

    meter = pyln.Meter(sr)
    current_lufs = meter.integrated_loudness(audio)

    if np.isinf(current_lufs) or np.isnan(current_lufs):
        return audio

    normalized = pyln.normalize.loudness(audio, current_lufs, target_lufs)
    return normalized


def transfer_dynamics(
    converted: np.ndarray,
    original: np.ndarray,
    sr: int,
    strength: float = 0.4,
    frame_ms: float = 50,
) -> np.ndarray:
    """원곡 보컬의 다이나믹 엔벨로프를 변환 보컬에 전사한다.

    RVC-Project #762, Sonarworks 2025 검증:
    - ratio 클램프 0.3~3.0 (20x → 노이즈 폭발)
    - 무음 구간(RMS < 0.001) → ratio=1.0 고정
    - ratio 곡선에 이동평균(11프레임) → 원곡 다이나믹 변화율과 1:1 매칭

    Args:
        converted: 변환된 보컬
        original: 원곡 보컬 (Demucs 분리 결과)
        sr: 샘플레이트
        strength: 전사 강도 (0=그대로, 1=완전복원). 0.4 = 원곡 변화율 매칭
        frame_ms: RMS 프레임 크기 (ms). 50ms 권장 (30ms→클릭 발생)
    """
    import librosa

    conv_mono = _to_mono(converted).astype(np.float32)
    orig_mono = _to_mono(original).astype(np.float32)

    min_len = min(len(conv_mono), len(orig_mono))
    conv_mono = conv_mono[:min_len]
    orig_mono = orig_mono[:min_len]

    frame_length = max(int(sr * frame_ms / 1000), 512)
    hop_length = frame_length // 2

    orig_rms = librosa.feature.rms(y=orig_mono, frame_length=frame_length, hop_length=hop_length)[0]
    conv_rms = librosa.feature.rms(y=conv_mono, frame_length=frame_length, hop_length=hop_length)[0]

    # 무음 보호: 변환 보컬 RMS < 0.001 → ratio 1.0 (증폭 금지)
    silence_mask = conv_rms < 0.001
    eps = 1e-6
    ratio = (orig_rms + eps) / (conv_rms + eps)
    ratio[silence_mask] = 1.0
    ratio = np.clip(ratio, 0.3, 3.0)  # 보수적 클램프 (RVC-Project #762)

    # 이동평균 스무딩 (5프레임) — 신호 추적력 유지 + 클릭 방지
    kernel = 5
    if len(ratio) > kernel:
        ratio = np.convolve(ratio, np.ones(kernel) / kernel, mode='same')

    blended = 1.0 + strength * (ratio - 1.0)

    # 프레임 → 샘플 보간
    frame_times = np.arange(len(blended)) * hop_length
    sample_times = np.arange(min_len)

    if frame_times[-1] < min_len - 1:
        frame_times = np.append(frame_times, min_len - 1)
        blended = np.append(blended, blended[-1])

    sample_ratio = np.interp(sample_times, frame_times, blended).astype(np.float32)

    # 적용
    if converted.ndim == 1:
        result = converted[:min_len] * sample_ratio
    else:
        result = converted[:min_len].copy()
        if result.shape[0] < result.shape[1]:
            for ch in range(result.shape[0]):
                result[ch] = result[ch] * sample_ratio
        else:
            for ch in range(result.shape[1]):
                result[:, ch] = result[:, ch] * sample_ratio

    return result


def gate_by_original(
    converted: np.ndarray,
    original: np.ndarray,
    sr: int,
    threshold: float = 0.01,
    frame_ms: float = 50,
) -> np.ndarray:
    """원곡이 조용한 구간에서 변환 보컬을 억제한다.

    RVC/HQ-SVC가 들숨·휴지 구간에서 저역 럼블을 생성하는 문제 해결.
    원곡 RMS < threshold인 구간은 변환 보컬도 원곡 레벨로 강제 감쇄.
    """
    import librosa

    orig_mono = _to_mono(original).astype(np.float32)
    conv_mono = _to_mono(converted).astype(np.float32)
    min_len = min(len(orig_mono), len(conv_mono))

    frame_length = max(int(sr * frame_ms / 1000), 512)
    hop = frame_length // 2

    orig_rms = librosa.feature.rms(y=orig_mono[:min_len], frame_length=frame_length, hop_length=hop)[0]
    conv_rms = librosa.feature.rms(y=conv_mono[:min_len], frame_length=frame_length, hop_length=hop)[0]

    # 원곡이 조용한 구간: 변환 보컬을 원곡 레벨로 강제
    eps = 1e-8
    gate_ratio = np.ones_like(orig_rms)
    quiet_mask = orig_rms < threshold
    gate_ratio[quiet_mask] = (orig_rms[quiet_mask] + eps) / (conv_rms[quiet_mask] + eps)
    gate_ratio = np.clip(gate_ratio, 0.01, 1.0)

    # 스무딩 (급격한 게이트 열림/닫힘 방지)
    kernel = 5
    if len(gate_ratio) > kernel:
        gate_ratio = np.convolve(gate_ratio, np.ones(kernel) / kernel, mode='same')

    # 프레임 → 샘플 보간
    frame_times = np.arange(len(gate_ratio)) * hop
    sample_times = np.arange(min_len)
    if frame_times[-1] < min_len - 1:
        frame_times = np.append(frame_times, min_len - 1)
        gate_ratio = np.append(gate_ratio, gate_ratio[-1])

    sample_gate = np.interp(sample_times, frame_times, gate_ratio).astype(np.float32)

    if converted.ndim == 1:
        return converted[:min_len] * sample_gate
    result = converted[:min_len].copy()
    if result.shape[0] < result.shape[1]:
        for ch in range(result.shape[0]):
            result[ch] = result[ch] * sample_gate
    else:
        for ch in range(result.shape[1]):
            result[:, ch] = result[:, ch] * sample_gate
    return result


def blend_high_frequency(
    converted: np.ndarray,
    source: np.ndarray,
    sr: int,
    cutoff_hz: float = 10000,
) -> np.ndarray:
    """10kHz 이상을 원본 소스에서 차용하여 자연스러운 기식/치찰 텍스처 복원.

    SYKI-SVC (ICASSP 2025, arxiv 2501.02953):
    Neural vocoder(HiFi-GAN)가 10kHz 이상에서 인공적인 스펙트럼 불연속을
    만드는 문제를 우회. 10kHz+ 대역은 음색(timbre) 정보 없이 기식음/공기
    텍스처만 담으므로 원본에서 그대로 차용해도 타겟 화자 음색에 영향 없음.
    """
    from scipy.signal import butter, sosfilt

    conv_mono = _to_mono(converted).astype(np.float32)
    src_mono = _to_mono(source).astype(np.float32)

    min_len = min(len(conv_mono), len(src_mono))
    conv_mono = conv_mono[:min_len]
    src_mono = src_mono[:min_len]

    nyq = sr / 2
    if cutoff_hz >= nyq:
        return converted

    sos_hp = butter(6, cutoff_hz / nyq, btype='high', output='sos')
    sos_lp = butter(6, cutoff_hz / nyq, btype='low', output='sos')

    source_hf = sosfilt(sos_hp, src_mono).astype(np.float32)
    source_lf = sosfilt(sos_lp, src_mono).astype(np.float32)
    converted_lf = sosfilt(sos_lp, conv_mono).astype(np.float32)

    # 원본의 자연스러운 HF/LF 비율을 보존하여 변환 보컬에 적용
    original_hf_ratio = np.mean(np.abs(source_hf)) / (np.mean(np.abs(source_lf)) + 1e-8)
    target_hf_level = np.mean(np.abs(converted_lf)) * original_hf_ratio
    actual_hf_level = np.mean(np.abs(source_hf)) + 1e-8
    blended_mono = converted_lf + source_hf * (target_hf_level / actual_hf_level)

    # 원본 shape 복원
    if converted.ndim == 1:
        return blended_mono
    result = np.stack([blended_mono, blended_mono], axis=0 if converted.shape[0] < converted.shape[1] else 1)
    return result[:, :min_len] if result.shape[0] < result.shape[1] else result[:min_len]


def add_warmth(audio: np.ndarray, drive: float = 0.08) -> np.ndarray:
    """부드러운 튜브 새추레이션 — 짝수 고조파로 따뜻함 추가.

    iZotope Harmonic Exciter 기준 5-15% drive.
    Soft clipping(tanh)은 주로 짝수 고조파를 생성하여
    아날로그 튜브 앰프의 따뜻한 특성을 재현.
    """
    audio = audio.astype(np.float32)
    # tanh soft clipping: drive가 높을수록 더 많은 고조파
    saturated = np.tanh(audio * (1.0 + drive * 10))
    # 원본과 블렌딩 (drive=0.08 → 8% 새추레이션)
    return audio * (1.0 - drive) + saturated * drive


def mix_vocal_and_instrumental(
    vocal: np.ndarray,
    instrumental: np.ndarray,
    sr: int,
    preset: PostProcessPreset = None,
) -> np.ndarray:
    """보컬과 반주를 전문적으로 믹싱"""
    if preset is None:
        preset = PRESETS["default"]

    vocal_norm = normalize_lufs(vocal, sr, preset.vocal_lufs)
    instrumental_norm = normalize_lufs(instrumental, sr, preset.instrumental_lufs)

    if vocal_norm.ndim == 2 and vocal_norm.shape[0] < vocal_norm.shape[1]:
        vocal_norm = vocal_norm.T
    if instrumental_norm.ndim == 2 and instrumental_norm.shape[0] < instrumental_norm.shape[1]:
        instrumental_norm = instrumental_norm.T

    if vocal_norm.ndim == 1:
        vocal_norm = np.stack([vocal_norm, vocal_norm], axis=1)
    if instrumental_norm.ndim == 1:
        instrumental_norm = np.stack([instrumental_norm, instrumental_norm], axis=1)

    min_len = min(len(vocal_norm), len(instrumental_norm))
    vocal_norm = vocal_norm[:min_len]
    instrumental_norm = instrumental_norm[:min_len]

    mixed = vocal_norm + instrumental_norm
    master = normalize_lufs(mixed, sr, preset.master_lufs)

    peak = np.max(np.abs(master))
    if peak > 0.99:
        master = master * (0.99 / peak)

    return master


def full_pipeline(
    vocal_path: str,
    instrumental_path: str,
    output_path: str,
    preset_name: str = "default",
    original_vocal_path: str | None = None,
    dynamics_strength: float = 0.4,
) -> str:
    """전체 후처리 파이프라인 실행

    Args:
        vocal_path: 변환된 보컬 WAV
        instrumental_path: 반주 WAV
        output_path: 출력 WAV
        preset_name: 프리셋 이름
        original_vocal_path: 원곡 보컬 WAV (다이나믹 전사용)
        dynamics_strength: 다이나믹 전사 강도 (0~1, 0.4=원곡 변화율 매칭)
    """
    preset = PRESETS.get(preset_name, PRESETS["default"])

    vocal, sr_v = sf.read(vocal_path, dtype="float32")
    instrumental, sr_i = sf.read(instrumental_path, dtype="float32")

    import librosa

    target_sr = max(sr_v, sr_i, 44100)

    if sr_v != target_sr:
        if vocal.ndim == 2:
            channels = [librosa.resample(vocal[:, ch], orig_sr=sr_v, target_sr=target_sr)
                        for ch in range(vocal.shape[1])]
            vocal = np.stack(channels, axis=1)
        else:
            vocal = librosa.resample(vocal, orig_sr=sr_v, target_sr=target_sr)

    if sr_i != target_sr:
        if instrumental.ndim == 2:
            channels = [librosa.resample(instrumental[:, ch], orig_sr=sr_i, target_sr=target_sr)
                        for ch in range(instrumental.shape[1])]
            instrumental = np.stack(channels, axis=1)
        else:
            instrumental = librosa.resample(instrumental, orig_sr=sr_i, target_sr=target_sr)

    sr = target_sr

    # 원곡 보컬 로드 (HF 블렌딩 + 다이나믹 전사용)
    original = None
    if original_vocal_path:
        original, sr_orig = sf.read(original_vocal_path, dtype="float32")
        if sr_orig != sr:
            if original.ndim == 2:
                channels = [librosa.resample(original[:, ch], orig_sr=sr_orig, target_sr=sr)
                            for ch in range(original.shape[1])]
                original = np.stack(channels, axis=1)
            else:
                original = librosa.resample(original, orig_sr=sr_orig, target_sr=sr)

    # 1. 원곡 기반 게이팅 — 들숨/휴지 구간 저역 럼블 제거
    if original is not None:
        vocal = gate_by_original(vocal, original, sr)

    # 2. 10kHz HF 블렌딩 — 보코더 인공 고역을 원곡 자연 고역으로 대체 (SYKI-SVC)
    if original is not None:
        vocal = blend_high_frequency(vocal, original, sr, cutoff_hz=10000)

    # 3. 보컬 이펙트 체인 (게이트→HPF→보정EQ→컴프→디에서→창의적EQ→리버브→리미터)
    vocal_processed = process_vocal(vocal, sr, preset)

    # 4. 튜브 새추레이션 — 짝수 고조파로 따뜻함 (iZotope 5-15% drive, 보수적 5%)
    vocal_processed = add_warmth(vocal_processed, drive=0.05)

    # 5. 다이나믹 전사 — 원곡 강약/호흡 복원
    if original is not None:
        vocal_processed = transfer_dynamics(vocal_processed, original, sr, strength=dynamics_strength)

    # 6. 보컬+반주 믹싱
    master = mix_vocal_and_instrumental(vocal_processed, instrumental, sr, preset)

    # 4. 저장
    sf.write(output_path, master, sr, subtype="PCM_16")

    return output_path
