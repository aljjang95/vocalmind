/**
 * YIN algorithm pitch detector using an inline AudioWorklet.
 *
 * The worklet code is embedded as a string and loaded via a Blob URL,
 * avoiding the need for a separate file (compatible with Next.js bundling).
 */

import { getAudioContext } from '@/lib/audio/audioEngine';
import { PITCH_CONFIDENCE_THRESHOLD } from '@/lib/audio/constants';
import { frequencyToNoteName, frequencyCentsOffset } from '@/lib/audio/musicUtils';

export interface PitchData {
  frequency: number;
  noteName: string;
  cents: number;
  confidence: number;
}

export type PitchCallback = (data: PitchData) => void;

let micSource: MediaStreamAudioSourceNode | null = null;
let workletNode: AudioWorkletNode | null = null;
let isActive = false;
let workletLoaded = false;

const WORKLET_CODE = `
const BUFFER_SIZE = 2048;
const THRESHOLD = 0.15;

class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(BUFFER_SIZE);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channelData = input[0];
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex] = channelData[i];
      this.bufferIndex++;
      if (this.bufferIndex >= BUFFER_SIZE) {
        const result = this.detectPitch(this.buffer);
        this.port.postMessage(result);
        this.bufferIndex = 0;
      }
    }
    return true;
  }

  detectPitch(buf) {
    const halfLen = Math.floor(buf.length / 2);
    const yinBuffer = new Float32Array(halfLen);

    // Step 1: Difference function
    for (let tau = 0; tau < halfLen; tau++) {
      let sum = 0;
      for (let i = 0; i < halfLen; i++) {
        const delta = buf[i] - buf[i + tau];
        sum += delta * delta;
      }
      yinBuffer[tau] = sum;
    }

    // Step 2: Cumulative mean normalized difference
    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfLen; tau++) {
      runningSum += yinBuffer[tau];
      yinBuffer[tau] = yinBuffer[tau] * tau / runningSum;
    }

    // Step 3: Absolute threshold
    let tauEstimate = -1;
    for (let tau = 2; tau < halfLen; tau++) {
      if (yinBuffer[tau] < THRESHOLD) {
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
    let betterTau;
    if (x0 === tauEstimate) {
      betterTau = yinBuffer[tauEstimate] <= yinBuffer[x2] ? tauEstimate : x2;
    } else if (x2 === tauEstimate) {
      betterTau = yinBuffer[tauEstimate] <= yinBuffer[x0] ? tauEstimate : x0;
    } else {
      const s0 = yinBuffer[x0], s1 = yinBuffer[tauEstimate], s2 = yinBuffer[x2];
      betterTau = tauEstimate + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }

    const confidence = 1 - (yinBuffer[tauEstimate] || 0);
    const frequency = sampleRate / betterTau;
    return { frequency, confidence };
  }
}
registerProcessor('pitch-processor', PitchProcessor);
`;

/**
 * Start real-time pitch detection from the microphone.
 *
 * @param onPitch - Callback invoked whenever a confident pitch is detected.
 */
export async function startPitchDetection(onPitch: PitchCallback): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isActive) return;

  const ctx = getAudioContext();

  // Load worklet if not already loaded
  if (!workletLoaded) {
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    try {
      await ctx.audioWorklet.addModule(url);
      workletLoaded = true;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Get microphone
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  micSource = ctx.createMediaStreamSource(stream);

  workletNode = new AudioWorkletNode(ctx, 'pitch-processor');
  workletNode.port.onmessage = (
    event: MessageEvent<{ frequency: number; confidence: number }>,
  ) => {
    const { frequency, confidence } = event.data;

    if (
      confidence >= PITCH_CONFIDENCE_THRESHOLD &&
      frequency > 50 &&
      frequency < 2000
    ) {
      onPitch({
        frequency,
        noteName: frequencyToNoteName(frequency),
        cents: frequencyCentsOffset(frequency),
        confidence,
      });
    }
  };

  micSource.connect(workletNode);
  // Do NOT connect to destination to avoid feedback
  isActive = true;
}

/** Stop pitch detection and release microphone. */
export function stopPitchDetection(): void {
  if (!isActive) return;

  if (workletNode) {
    workletNode.disconnect();
    workletNode = null;
  }

  if (micSource) {
    const tracks = micSource.mediaStream.getTracks();
    tracks.forEach((t) => t.stop());
    micSource.disconnect();
    micSource = null;
  }

  isActive = false;
}

/** Check whether pitch detection is currently active. */
export function isPitchDetectionActive(): boolean {
  return isActive;
}
