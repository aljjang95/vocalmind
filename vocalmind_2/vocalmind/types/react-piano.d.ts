declare module 'react-piano' {
  import { ComponentType } from 'react';

  interface NoteRange {
    first: number;
    last: number;
  }

  interface PianoProps {
    noteRange: NoteRange;
    playNote: (midiNumber: number) => void;
    stopNote: (midiNumber: number) => void;
    activeNotes?: number[];
    width?: number;
    keyWidthToHeight?: number;
    renderNoteLabel?: (params: { midiNumber: number; isActive: boolean; isAccidental: boolean }) => React.ReactNode;
    className?: string;
    disabled?: boolean;
    onPlayNoteInput?: (midiNumber: number) => void;
    onStopNoteInput?: (midiNumber: number) => void;
  }

  export const Piano: ComponentType<PianoProps>;
  export const ControlledPiano: ComponentType<PianoProps>;
  export const Keyboard: ComponentType<PianoProps>;

  export const MidiNumbers: {
    fromNote: (note: string) => number;
    getAttributes: (midiNumber: number) => { note: string; octave: number; pitchName: string; isAccidental: boolean };
    MIN_MIDI_NUMBER: number;
    MAX_MIDI_NUMBER: number;
    NATURAL_MIDI_NUMBERS: number[];
  };

  export const KeyboardShortcuts: {
    create: (config: { firstNote: number; lastNote: number; keyboardConfig: unknown[] }) => unknown[];
    HOME_ROW: unknown[];
    BOTTOM_ROW: unknown[];
    QWERTY_ROW: unknown[];
  };
}

declare module 'react-piano/dist/styles.css';
