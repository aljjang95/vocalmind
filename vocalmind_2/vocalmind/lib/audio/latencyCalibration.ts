/**
 * 오디오 레이턴시 캘리브레이션 — 사용자 디바이스의 재생 지연을 측정한다.
 *
 * 절차:
 * 1) 메트로놈 4박 재생 (120 BPM, 500ms 간격)
 * 2) 사용자가 각 박자에 tap (키보드/버튼)
 * 3) tap 시각 - 메트로놈 박자 시각 = 지연 ms 평균
 *
 * 이상치는 Tukey fence(1.5 × IQR)로 제거.
 */

const BEAT_COUNT = 4;
const BEAT_INTERVAL_MS = 500;
const DEFAULT_LATENCY_MS = 60;

export interface LatencyMeasurement {
  outputLatencyMs: number;
  confidence: number; // 0~1 (수집 샘플 수 + IQR 기반)
}

export interface CalibrationController {
  /** 메트로놈 시작 + 예상 박자 시각 반환 */
  startBeats: () => number[];
  /** tap 기록 (사용자 스페이스바 또는 버튼) */
  recordTap: (timestampMs: number) => void;
  /** 측정 완료 + 결과 반환 (clean up) */
  finish: () => LatencyMeasurement;
}

/**
 * 캘리브레이션 컨트롤러 생성.
 *
 * @param audioCtx 브라우저 AudioContext (재생 tick 사운드용)
 */
export function createCalibration(audioCtx: AudioContext): CalibrationController {
  const beatTimestamps: number[] = [];
  const tapTimestamps: number[] = [];
  let active = false;

  return {
    startBeats(): number[] {
      active = true;
      beatTimestamps.length = 0;
      tapTimestamps.length = 0;

      const now = audioCtx.currentTime;
      const scheduled: number[] = [];

      for (let i = 0; i < BEAT_COUNT; i++) {
        const offsetSec = i * (BEAT_INTERVAL_MS / 1000);
        const targetTime = now + offsetSec + 0.5; // 0.5s 준비시간
        scheduled.push(targetTime);

        // 1kHz 짧은 tick 재생
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = 1000;
        gain.gain.setValueAtTime(0, targetTime);
        gain.gain.linearRampToValueAtTime(0.3, targetTime + 0.005);
        gain.gain.linearRampToValueAtTime(0, targetTime + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(targetTime);
        osc.stop(targetTime + 0.06);
      }

      // 성능 시계 기준으로도 기록 (tap 비교용)
      const perfNow = performance.now();
      const audioNow = audioCtx.currentTime;
      scheduled.forEach((t) => {
        const relSec = t - audioNow;
        beatTimestamps.push(perfNow + relSec * 1000);
      });

      return scheduled;
    },

    recordTap(timestampMs: number): void {
      if (!active) return;
      tapTimestamps.push(timestampMs);
    },

    finish(): LatencyMeasurement {
      active = false;

      if (tapTimestamps.length === 0 || beatTimestamps.length === 0) {
        return { outputLatencyMs: DEFAULT_LATENCY_MS, confidence: 0 };
      }

      // 각 tap을 가장 가까운 beat에 매칭하고 오차 수집
      const errors: number[] = [];
      for (const tap of tapTimestamps) {
        let minDiff = Infinity;
        let bestDelta = 0;
        for (const beat of beatTimestamps) {
          const diff = Math.abs(tap - beat);
          if (diff < minDiff) {
            minDiff = diff;
            bestDelta = tap - beat;
          }
        }
        // 400ms 초과는 잘못된 tap (박자 놓침) — 제외
        if (minDiff < 400) errors.push(bestDelta);
      }

      if (errors.length === 0) {
        return { outputLatencyMs: DEFAULT_LATENCY_MS, confidence: 0 };
      }

      const cleaned = removeOutliers(errors);
      const avg = cleaned.reduce((sum, v) => sum + v, 0) / cleaned.length;
      const confidence = Math.min(1, cleaned.length / BEAT_COUNT);

      // 평균 지연 값을 0~500ms로 클램프
      const latency = Math.max(0, Math.min(500, Math.round(avg)));
      return { outputLatencyMs: latency, confidence };
    },
  };
}

/** Tukey fence로 이상치 제거 (IQR × 1.5) */
function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return values.filter((v) => v >= lo && v <= hi);
}

/** 브라우저 자동 감지 — 지원 시 AudioContext의 outputLatency + baseLatency 합 */
export function autoDetectLatency(audioCtx: AudioContext): number {
  const output = (audioCtx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
  const base = audioCtx.baseLatency ?? 0;
  const ms = Math.round((output + base) * 1000);
  return ms > 0 ? Math.min(500, ms) : DEFAULT_LATENCY_MS;
}
