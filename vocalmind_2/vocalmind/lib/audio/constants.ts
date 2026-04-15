/** Audio-related constants shared across the HLB 보컬스튜디오 audio infrastructure. */

export const DEFAULT_BPM = 120;
export const MIN_BPM = 40;
export const MAX_BPM = 240;

export const DEFAULT_REVERB_MIX = 0.3;
export const DEFAULT_MASTER_VOLUME = 0.8;
export const DEFAULT_ACCOMPANIMENT_VOLUME = 0.8;
export const DEFAULT_MIC_VOLUME = 0.8;
export const DEFAULT_METRONOME_VOLUME = 0.5;

export const DEFAULT_REPEAT_COUNT = 1;
export const DEFAULT_START_KEY = 60; // C4
export const DEFAULT_END_KEY = 72; // C5

export const MIN_MIDI_NOTE = 36; // C2
export const MAX_MIDI_NOTE = 96; // C7

export const REST_NOTE = -1;

export const PITCH_BUFFER_SIZE = 2048;
export const PITCH_CONFIDENCE_THRESHOLD = 0.85;
export const PITCH_CENTS_GOOD = 15;
export const PITCH_CENTS_OK = 30;
export const PITCH_CENTS_BAD = 50;

export const SCHEDULER_LOOKAHEAD_MS = 25;
export const SCHEDULER_SCHEDULE_AHEAD_S = 0.1;

export const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B',
] as const;

export const SEMITONES_PER_OCTAVE = 12;
export const A4_FREQUENCY = 440;
export const A4_MIDI_NOTE = 69;

export const TRANSPOSE_UP = 1 as const;
export const TRANSPOSE_DOWN = -1 as const;

export const LATENCY_OFFSET_MIN = -200;
export const LATENCY_OFFSET_MAX = 200;
export const DEFAULT_LATENCY_OFFSET = 0;
