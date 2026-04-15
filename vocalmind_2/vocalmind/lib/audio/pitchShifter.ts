/**
 * Granular Pitch Shifter using an inline AudioWorklet.
 *
 * Uses a granular synthesis approach for pitch shifting:
 * - Splits input into overlapping grains
 * - Resamples grains at the desired pitch ratio
 * - Overlaps output grains with Hann windowing for smooth transitions
 *
 * Supports -6 to +6 semitone shifts. When shift is 0, audio passes through
 * unmodified (bypass) to save CPU.
 *
 * Follows the inline Blob URL pattern from pitchDetector.ts.
 */

import { getAudioContext } from '@/lib/audio/audioEngine';

// ── Inline Worklet Code ──────────────────────────────────────

const PITCH_SHIFTER_WORKLET_CODE = `
const GRAIN_SIZE = 2048;
const HOP_SIZE = 512;
const MAX_DELAY = 4096;

class PitchShifterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // Circular input buffer
    this.inputBuffer = new Float32Array(MAX_DELAY * 2);
    this.inputWritePos = 0;

    // Grain parameters
    this.grainSize = GRAIN_SIZE;
    this.hopSize = HOP_SIZE;

    // Pitch ratio (1.0 = no shift)
    this.pitchRatio = 1.0;

    // Output accumulation buffer
    this.outputBuffer = new Float32Array(GRAIN_SIZE * 4);
    this.outputReadPos = 0;
    this.outputWritePos = 0;

    // Phase accumulators for two overlapping grains
    this.grainPhaseA = 0;
    this.grainPhaseB = this.grainSize / 2;

    // Hann window (precomputed)
    this.hannWindow = new Float32Array(GRAIN_SIZE);
    for (let i = 0; i < GRAIN_SIZE; i++) {
      this.hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (GRAIN_SIZE - 1)));
    }

    // Read position in input buffer (fractional)
    this.readPosA = 0;
    this.readPosB = this.grainSize / 2;
    this.sampleCounter = 0;

    this.port.onmessage = (e) => {
      if (e.data.type === 'setPitchShift') {
        const semitones = Math.max(-6, Math.min(6, e.data.semitones));
        this.pitchRatio = Math.pow(2, semitones / 12);
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) return true;

    const inChannel = input[0];
    const outChannel = output[0];
    const len = inChannel.length;

    // Bypass when pitchRatio is 1.0 (no shift)
    if (Math.abs(this.pitchRatio - 1.0) < 0.001) {
      for (let i = 0; i < len; i++) {
        outChannel[i] = inChannel[i];
      }
      return true;
    }

    const bufLen = this.inputBuffer.length;

    // Write input samples into circular buffer
    for (let i = 0; i < len; i++) {
      this.inputBuffer[this.inputWritePos] = inChannel[i];
      this.inputWritePos = (this.inputWritePos + 1) % bufLen;
    }

    // Process each output sample using two overlapping grains
    for (let i = 0; i < len; i++) {
      // Grain A
      const grainPosA = this.grainPhaseA;
      const windowA = this.hannWindow[Math.floor(grainPosA) % this.grainSize] || 0;
      const readIdxA = this.readPosA;
      const readIdxAInt = Math.floor(readIdxA);
      const fracA = readIdxA - readIdxAInt;
      const idxA0 = ((this.inputWritePos - this.grainSize + readIdxAInt) % bufLen + bufLen) % bufLen;
      const idxA1 = (idxA0 + 1) % bufLen;
      const sampleA = this.inputBuffer[idxA0] * (1 - fracA) + this.inputBuffer[idxA1] * fracA;

      // Grain B (offset by half grain size)
      const grainPosB = this.grainPhaseB;
      const windowB = this.hannWindow[Math.floor(grainPosB) % this.grainSize] || 0;
      const readIdxB = this.readPosB;
      const readIdxBInt = Math.floor(readIdxB);
      const fracB = readIdxB - readIdxBInt;
      const idxB0 = ((this.inputWritePos - this.grainSize + readIdxBInt) % bufLen + bufLen) % bufLen;
      const idxB1 = (idxB0 + 1) % bufLen;
      const sampleB = this.inputBuffer[idxB0] * (1 - fracB) + this.inputBuffer[idxB1] * fracB;

      // Mix both grains
      outChannel[i] = sampleA * windowA + sampleB * windowB;

      // Advance read positions at pitch ratio speed
      this.readPosA += this.pitchRatio;
      this.readPosB += this.pitchRatio;
      this.grainPhaseA += 1;
      this.grainPhaseB += 1;

      // Reset grain A when it finishes
      if (this.grainPhaseA >= this.grainSize) {
        this.grainPhaseA = 0;
        this.readPosA = 0;
      }

      // Reset grain B when it finishes
      if (this.grainPhaseB >= this.grainSize) {
        this.grainPhaseB = 0;
        this.readPosB = 0;
      }
    }

    return true;
  }
}

registerProcessor('pitch-shifter-processor', PitchShifterProcessor);
`;

// ── Module State ────────────────────────────────────────────

let workletLoaded = false;
let pitchShifterNode: AudioWorkletNode | null = null;

// ── Public API ──────────────────────────────────────────────

/**
 * Create a PitchShifter AudioWorkletNode.
 * Loads the worklet module on first call.
 *
 * @returns The AudioWorkletNode that can be inserted into the audio graph
 */
export async function createPitchShifter(
  audioContext: AudioContext,
): Promise<AudioWorkletNode> {
  if (typeof window === 'undefined') {
    throw new Error('PitchShifter must not be used during SSR.');
  }

  // Load worklet if not already loaded
  if (!workletLoaded) {
    const blob = new Blob([PITCH_SHIFTER_WORKLET_CODE], {
      type: 'application/javascript',
    });
    const url = URL.createObjectURL(blob);
    try {
      await audioContext.audioWorklet.addModule(url);
      workletLoaded = true;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  pitchShifterNode = new AudioWorkletNode(
    audioContext,
    'pitch-shifter-processor',
  );

  return pitchShifterNode;
}

/**
 * Set the pitch shift amount in semitones.
 * Range: -6 to +6. 0 = bypass (passthrough, no CPU cost for processing).
 */
export function setPitchShift(semitones: number): void {
  if (!pitchShifterNode) return;

  const clamped = Math.max(-6, Math.min(6, semitones));
  pitchShifterNode.port.postMessage({
    type: 'setPitchShift',
    semitones: clamped,
  });
}

/**
 * Get the current pitch shifter node (if created).
 */
export function getPitchShifterNode(): AudioWorkletNode | null {
  return pitchShifterNode;
}

/**
 * Disconnect and clean up the pitch shifter node.
 */
export function disposePitchShifter(): void {
  if (pitchShifterNode) {
    pitchShifterNode.disconnect();
    pitchShifterNode = null;
  }
}
