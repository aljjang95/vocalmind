/**
 * Breath detector using AnalyserNode (no AudioWorklet).
 *
 * Detection approach:
 *  1. Compute overall RMS of the microphone signal.
 *  2. Compute the energy ratio of low frequencies (100-500 Hz) to full spectrum.
 *  3. A breath is detected when:
 *     - RMS exceeds calibrated noise floor + threshold
 *     - Low-frequency energy ratio exceeds a minimum (breaths are predominantly low-freq)
 *
 * Includes a 3-second environment noise calibration phase.
 */

import { getAudioContext } from '@/lib/audio/audioEngine';

export interface BreathEvent {
  /** Whether a breath is currently detected. */
  isBreathing: boolean;
  /** Current RMS level (0-1). */
  rms: number;
  /** Low-frequency energy ratio (0-1). */
  lowFreqRatio: number;
  /** Calibrated noise floor RMS. */
  noiseFloor: number;
}

export type BreathCallback = (event: BreathEvent) => void;

const FFT_SIZE = 2048;
const LOW_FREQ_MIN = 100; // Hz
const LOW_FREQ_MAX = 500; // Hz
const CALIBRATION_DURATION_MS = 3000;
const ANALYSIS_INTERVAL_MS = 50;
const RMS_THRESHOLD_ABOVE_NOISE = 0.02;
const LOW_FREQ_RATIO_MIN = 0.4;

let analyserNode: AnalyserNode | null = null;
let micSource: MediaStreamAudioSourceNode | null = null;
let animFrameId: ReturnType<typeof setInterval> | null = null;
let isActive = false;
let noiseFloor = 0;

/**
 * Calibrate the noise floor by sampling ambient noise for the given duration.
 */
async function calibrateNoiseFloor(
  analyser: AnalyserNode,
  durationMs: number,
): Promise<number> {
  const dataArray = new Float32Array(analyser.fftSize);
  const samples: number[] = [];
  const interval = 50;
  const iterations = Math.floor(durationMs / interval);

  return new Promise<number>((resolve) => {
    let count = 0;
    const id = setInterval(() => {
      analyser.getFloatTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      samples.push(Math.sqrt(sum / dataArray.length));
      count++;

      if (count >= iterations) {
        clearInterval(id);
        // Use the average RMS as the noise floor
        const avg =
          samples.length > 0
            ? samples.reduce((a, b) => a + b, 0) / samples.length
            : 0;
        resolve(avg);
      }
    }, interval);
  });
}

/**
 * Compute the RMS of the current time-domain signal.
 */
function computeRMS(analyser: AnalyserNode, dataArray: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(dataArray);
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i] * dataArray[i];
  }
  return Math.sqrt(sum / dataArray.length);
}

/**
 * Compute the ratio of energy in the low-frequency band (100-500 Hz)
 * to the total energy across all frequency bins.
 */
function computeLowFreqRatio(
  analyser: AnalyserNode,
  freqData: Float32Array<ArrayBuffer>,
  sampleRate: number,
): number {
  analyser.getFloatFrequencyData(freqData);

  const binCount = analyser.frequencyBinCount;
  const binWidth = sampleRate / (binCount * 2);

  const lowBinStart = Math.floor(LOW_FREQ_MIN / binWidth);
  const lowBinEnd = Math.min(Math.ceil(LOW_FREQ_MAX / binWidth), binCount - 1);

  let totalEnergy = 0;
  let lowEnergy = 0;

  for (let i = 0; i < binCount; i++) {
    // freqData is in dB; convert to linear power
    const power = Math.pow(10, freqData[i] / 10);
    totalEnergy += power;
    if (i >= lowBinStart && i <= lowBinEnd) {
      lowEnergy += power;
    }
  }

  if (totalEnergy === 0) return 0;
  return lowEnergy / totalEnergy;
}

/**
 * Start breath detection from the microphone.
 * Performs a 3-second calibration of the ambient noise floor first.
 *
 * @param onBreath   - Callback invoked at each analysis frame.
 * @param onCalibrationComplete - Optional callback when calibration finishes.
 * @returns A promise that resolves after calibration is complete.
 */
export async function startBreathDetection(
  onBreath: BreathCallback,
  onCalibrationComplete?: (noiseFloorValue: number) => void,
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isActive) return;

  const ctx = getAudioContext();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  micSource = ctx.createMediaStreamSource(stream);

  analyserNode = ctx.createAnalyser();
  analyserNode.fftSize = FFT_SIZE;
  analyserNode.smoothingTimeConstant = 0.3;

  micSource.connect(analyserNode);
  // Do NOT connect to destination to avoid feedback

  isActive = true;

  // Calibration phase
  noiseFloor = await calibrateNoiseFloor(analyserNode, CALIBRATION_DURATION_MS);
  onCalibrationComplete?.(noiseFloor);

  // If stopped during calibration, bail out
  if (!isActive) return;

  // Analysis loop
  const timeDomainData = new Float32Array(analyserNode.fftSize);
  const freqData = new Float32Array(analyserNode.frequencyBinCount);

  animFrameId = setInterval(() => {
    if (!analyserNode || !isActive) return;

    const rms = computeRMS(analyserNode, timeDomainData);
    const lowFreqRatio = computeLowFreqRatio(analyserNode, freqData, ctx.sampleRate);

    const isBreathing =
      rms > noiseFloor + RMS_THRESHOLD_ABOVE_NOISE &&
      lowFreqRatio > LOW_FREQ_RATIO_MIN;

    onBreath({
      isBreathing,
      rms,
      lowFreqRatio,
      noiseFloor,
    });
  }, ANALYSIS_INTERVAL_MS);
}

/** Stop breath detection and release the microphone. */
export function stopBreathDetection(): void {
  if (!isActive) return;

  isActive = false;

  if (animFrameId !== null) {
    clearInterval(animFrameId);
    animFrameId = null;
  }

  if (analyserNode) {
    analyserNode.disconnect();
    analyserNode = null;
  }

  if (micSource) {
    const tracks = micSource.mediaStream.getTracks();
    tracks.forEach((t) => t.stop());
    micSource.disconnect();
    micSource = null;
  }

  noiseFloor = 0;
}

/** Check whether breath detection is currently active. */
export function isBreathDetectionActive(): boolean {
  return isActive;
}

/** Get the last calibrated noise floor value. */
export function getCalibratedNoiseFloor(): number {
  return noiseFloor;
}
