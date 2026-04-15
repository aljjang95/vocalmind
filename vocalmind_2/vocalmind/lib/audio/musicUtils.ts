/**
 * Music theory utility functions.
 * Pure functions with no browser dependencies -- safe for SSR.
 */

import {
  NOTE_NAMES,
  SEMITONES_PER_OCTAVE,
  A4_FREQUENCY,
  A4_MIDI_NOTE,
} from '@/lib/audio/constants';

/** Convert a MIDI note number to its frequency in Hz. */
export function midiToFrequency(midiNote: number): number {
  return A4_FREQUENCY * Math.pow(2, (midiNote - A4_MIDI_NOTE) / SEMITONES_PER_OCTAVE);
}

/** Convert a frequency in Hz to the nearest MIDI note number. */
export function frequencyToMidi(frequency: number): number {
  return Math.round(
    SEMITONES_PER_OCTAVE * Math.log2(frequency / A4_FREQUENCY) + A4_MIDI_NOTE,
  );
}

/** Convert a MIDI note number to a human-readable name (e.g. "C4"). */
export function midiToNoteName(midiNote: number): string {
  const octave = Math.floor(midiNote / SEMITONES_PER_OCTAVE) - 1;
  const noteIndex = midiNote % SEMITONES_PER_OCTAVE;
  const name = NOTE_NAMES[noteIndex];
  if (!name) return '';
  return `${name}${octave}`;
}

/** Convert a frequency in Hz to the nearest note name (e.g. "A4"). */
export function frequencyToNoteName(frequency: number): string {
  const midi = frequencyToMidi(frequency);
  return midiToNoteName(midi);
}

/** Return the cents offset from the nearest semitone for a given frequency. */
export function frequencyCentsOffset(frequency: number): number {
  const midi =
    SEMITONES_PER_OCTAVE * Math.log2(frequency / A4_FREQUENCY) + A4_MIDI_NOTE;
  const roundedMidi = Math.round(midi);
  return Math.round((midi - roundedMidi) * 100);
}

/** Convert a semitone interval to a human-readable label. */
export function semitonesToInterval(semitones: number): string {
  if (semitones === -1) return '쉼';

  const intervals: Record<number, string> = {
    0: '1',
    1: 'b2',
    2: '2',
    3: 'b3',
    4: '3',
    5: '4',
    6: 'b5',
    7: '5',
    8: 'b6',
    9: '6',
    10: 'b7',
    11: '7',
    12: '8',
  };

  if (semitones <= 12) {
    return intervals[semitones] ?? String(semitones);
  }

  const octaves = Math.floor(semitones / SEMITONES_PER_OCTAVE);
  const remainder = semitones % SEMITONES_PER_OCTAVE;
  const base = intervals[remainder] ?? String(remainder);
  const octaveSuffix = octaves === 1 ? '(+oct)' : `(+${octaves}oct)`;
  return `${base}${octaveSuffix}`;
}

/** Convert a note name (e.g. "C4") to a MIDI note number. Returns -1 on invalid input. */
export function noteNameToMidi(noteName: string): number {
  const match = noteName.match(/^([A-G]#?)(\d+)$/);
  if (!match) return -1;
  const [, note, octaveStr] = match;
  const noteIndex = NOTE_NAMES.indexOf(note as (typeof NOTE_NAMES)[number]);
  if (noteIndex === -1 || !octaveStr) return -1;
  const octave = parseInt(octaveStr, 10);
  return (octave + 1) * SEMITONES_PER_OCTAVE + noteIndex;
}
