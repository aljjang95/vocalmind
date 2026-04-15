/**
 * Impulse-response based convolver reverb.
 * Provides a dry/wet mix control with lazy initialization.
 */

import { getAudioContext } from '@/lib/audio/audioEngine';

let convolver: ConvolverNode | null = null;
let dryGain: GainNode | null = null;
let wetGain: GainNode | null = null;
let reverbInput: GainNode | null = null;
let reverbOutput: GainNode | null = null;

/**
 * Generate a synthetic impulse response (2-second exponential decay).
 */
function generateImpulseResponse(ctx: AudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * 2; // 2-second reverb tail
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.exp(-3 * t);
    }
  }

  return buffer;
}

/**
 * Get the reverb processing nodes (lazy-initialized).
 * Connect your source to `input` and route `output` to your destination.
 */
export function getReverbNodes(): { input: GainNode; output: GainNode } {
  const ctx = getAudioContext();

  if (!reverbInput) {
    reverbInput = ctx.createGain();
    reverbOutput = ctx.createGain();
    dryGain = ctx.createGain();
    wetGain = ctx.createGain();
    convolver = ctx.createConvolver();

    convolver.buffer = generateImpulseResponse(ctx);

    reverbInput.connect(dryGain);
    reverbInput.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(reverbOutput!);
    wetGain.connect(reverbOutput!);

    setReverbMix(0.3);
  }

  return {
    input: reverbInput,
    output: reverbOutput!,
  };
}

/**
 * Set the dry/wet mix ratio.
 * @param dryWet - 0 = fully dry, 1 = fully wet.
 */
export function setReverbMix(dryWet: number): void {
  const clamped = Math.max(0, Math.min(1, dryWet));
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  if (dryGain) {
    dryGain.gain.setValueAtTime(1 - clamped, now);
  }
  if (wetGain) {
    wetGain.gain.setValueAtTime(clamped, now);
  }
}
