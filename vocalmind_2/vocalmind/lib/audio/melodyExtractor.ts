/**
 * Melody extractor: extracts pitch data from a vocal AudioBuffer
 * using the YIN algorithm at 50ms intervals via OfflineAudioContext.
 *
 * The YIN core logic is duplicated from pitchDetector.ts (which runs
 * inside an AudioWorklet and cannot be imported directly).
 */

import { frequencyToNoteName } from '@/lib/audio/musicUtils';
import type { MelodyPoint } from '@/types';

// ── YIN 핵심 로직 (pitchDetector.ts AudioWorklet에서 추출) ──

const YIN_BUFFER_SIZE = 2048;
const YIN_THRESHOLD = 0.15;
const MIN_FREQUENCY = 50;
const MAX_FREQUENCY = 2000;
const CONFIDENCE_THRESHOLD = 0.85;

interface YinResult {
  frequency: number;
  confidence: number;
}

function yinDetectPitch(buffer: Float32Array, sampleRate: number): YinResult {
  const halfLen = Math.floor(buffer.length / 2);
  const yinBuffer = new Float32Array(halfLen);

  // Step 1: Difference function
  for (let tau = 0; tau < halfLen; tau++) {
    let sum = 0;
    for (let i = 0; i < halfLen; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    yinBuffer[tau] = sum;
  }

  // Step 2: Cumulative mean normalized difference
  yinBuffer[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau < halfLen; tau++) {
    runningSum += yinBuffer[tau];
    yinBuffer[tau] = (yinBuffer[tau] * tau) / runningSum;
  }

  // Step 3: Absolute threshold
  let tauEstimate = -1;
  for (let tau = 2; tau < halfLen; tau++) {
    if (yinBuffer[tau] < YIN_THRESHOLD) {
      while (tau + 1 < halfLen && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++;
      }
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate === -1) return { frequency: 0, confidence: 0 };

  // Step 4: Parabolic interpolation
  const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1;
  const x2 = tauEstimate + 1 < halfLen ? tauEstimate + 1 : tauEstimate;
  let betterTau: number;
  if (x0 === tauEstimate) {
    betterTau = yinBuffer[tauEstimate] <= yinBuffer[x2] ? tauEstimate : x2;
  } else if (x2 === tauEstimate) {
    betterTau = yinBuffer[tauEstimate] <= yinBuffer[x0] ? tauEstimate : x0;
  } else {
    const s0 = yinBuffer[x0];
    const s1 = yinBuffer[tauEstimate];
    const s2 = yinBuffer[x2];
    betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
  }

  const confidence = 1 - (yinBuffer[tauEstimate] || 0);
  const frequency = sampleRate / betterTau;
  return { frequency, confidence };
}

// ── 멜로디 추출 ──

const ANALYSIS_INTERVAL_MS = 50;

/**
 * Extract melody points from a vocal AudioBuffer at 50ms intervals.
 *
 * @param vocalBuffer - Decoded AudioBuffer of the vocal track
 * @returns Array of MelodyPoint with time, frequency, and noteName
 */
export async function extractMelody(vocalBuffer: AudioBuffer): Promise<MelodyPoint[]> {
  if (typeof window === 'undefined') {
    throw new Error('extractMelody must not be called during SSR.');
  }

  const sampleRate = vocalBuffer.sampleRate;
  const channelData = vocalBuffer.getChannelData(0);
  const totalSamples = channelData.length;

  const intervalSamples = Math.floor((ANALYSIS_INTERVAL_MS / 1000) * sampleRate);
  const melodyPoints: MelodyPoint[] = [];

  for (let offset = 0; offset + YIN_BUFFER_SIZE <= totalSamples; offset += intervalSamples) {
    const segment = channelData.subarray(offset, offset + YIN_BUFFER_SIZE);
    const result = yinDetectPitch(segment, sampleRate);
    const time = offset / sampleRate;

    if (
      result.confidence >= CONFIDENCE_THRESHOLD &&
      result.frequency > MIN_FREQUENCY &&
      result.frequency < MAX_FREQUENCY
    ) {
      melodyPoints.push({
        time,
        frequency: result.frequency,
        noteName: frequencyToNoteName(result.frequency),
      });
    } else {
      melodyPoints.push({
        time,
        frequency: 0,
        noteName: '',
      });
    }
  }

  return melodyPoints;
}
