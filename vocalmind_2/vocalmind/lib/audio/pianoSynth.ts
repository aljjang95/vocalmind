/**
 * Piano synthesizer using 6-harmonic additive synthesis with ADSR envelope.
 * Produces a warm piano-like tone suitable for vocal training accompaniment.
 */

import { getAudioContext } from '@/lib/audio/audioEngine';
import { midiToFrequency } from '@/lib/audio/musicUtils';
import { REST_NOTE } from '@/lib/audio/constants';

interface HarmonicDef {
  ratio: number;
  amplitude: number;
}

const HARMONICS: HarmonicDef[] = [
  { ratio: 1, amplitude: 1.0 },
  { ratio: 2, amplitude: 0.5 },
  { ratio: 3, amplitude: 0.25 },
  { ratio: 4, amplitude: 0.12 },
  { ratio: 5, amplitude: 0.06 },
  { ratio: 6, amplitude: 0.03 },
];

const ATTACK_TIME = 0.005;
const DECAY_TIME = 0.3;
const SUSTAIN_LEVEL = 0.15;
const RELEASE_TIME = 0.4;

/**
 * Play a single piano note through the given destination node.
 *
 * @param destination - The AudioNode to route the sound into.
 * @param midiNote   - MIDI note number (or REST_NOTE to skip).
 * @param duration   - Note duration in seconds (before release).
 * @param time       - Scheduled start time (defaults to ctx.currentTime).
 */
export function playNote(
  destination: AudioNode,
  midiNote: number,
  duration: number,
  time?: number,
): void {
  if (midiNote === REST_NOTE) return;

  const ctx = getAudioContext();
  const startTime = time ?? ctx.currentTime;
  const frequency = midiToFrequency(midiNote);

  const noteGain = ctx.createGain();
  noteGain.connect(destination);

  // ADSR envelope
  const endOfDecay = startTime + ATTACK_TIME + DECAY_TIME;
  const noteOff = startTime + duration;
  const endOfRelease = noteOff + RELEASE_TIME;

  noteGain.gain.setValueAtTime(0, startTime);
  noteGain.gain.linearRampToValueAtTime(0.3, startTime + ATTACK_TIME);
  noteGain.gain.exponentialRampToValueAtTime(
    Math.max(0.3 * SUSTAIN_LEVEL, 0.001),
    endOfDecay,
  );
  noteGain.gain.setValueAtTime(noteGain.gain.value, noteOff);
  noteGain.gain.exponentialRampToValueAtTime(0.001, endOfRelease);

  // Higher notes decay faster
  const decayMult = Math.max(0.3, 1 - (midiNote - 60) * 0.008);

  for (const harmonic of HARMONICS) {
    const osc = ctx.createOscillator();
    const harmonicGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency * harmonic.ratio, startTime);

    const amp = harmonic.amplitude * decayMult;
    harmonicGain.gain.setValueAtTime(amp, startTime);
    harmonicGain.gain.exponentialRampToValueAtTime(
      Math.max(amp * 0.01, 0.0001),
      endOfRelease,
    );

    osc.connect(harmonicGain);
    harmonicGain.connect(noteGain);

    osc.start(startTime);
    osc.stop(endOfRelease + 0.05);
  }
}
