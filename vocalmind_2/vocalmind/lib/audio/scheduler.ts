/**
 * Lookahead scheduler for pattern playback with auto-transposition and section looping.
 *
 * Uses a Web Audio "lookahead" approach: a setTimeout loop checks every
 * SCHEDULER_LOOKAHEAD_MS whether any notes need to be scheduled within the
 * next SCHEDULER_SCHEDULE_AHEAD_S seconds.
 */

import { getAudioContext, getAccompanimentGain, getMetronomeGain } from '@/lib/audio/audioEngine';
import { getReverbNodes } from '@/lib/audio/reverb';
import { playNote } from '@/lib/audio/pianoSynth';
import { playClick } from '@/lib/audio/metronome';
import {
  REST_NOTE,
  SCHEDULER_LOOKAHEAD_MS,
  SCHEDULER_SCHEDULE_AHEAD_S,
} from '@/lib/audio/constants';

export interface SchedulerCallbacks {
  onNotePlay?: (midiNote: number, index: number) => void;
  onTranspose?: (newRoot: number) => void;
  onComplete?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

let timerId: ReturnType<typeof setTimeout> | null = null;
let isPlaying = false;
let isPaused = false;
let currentNoteIndex = 0;
let nextNoteTime = 0;
let pattern: number[] = [];
let bpm = 120;
let rootNote = 60;
let startKey = 60;
let endKey = 72;
let transposeDirection: 1 | -1 = 1;
let repeatCount = 1;
let currentRepeat = 0;
let callbacks: SchedulerCallbacks = {};
let isMetronomeEnabled = false;
let sectionStart: number | null = null;
let sectionEnd: number | null = null;
let pausedRootNote = 60;
let pausedNoteIndex = 0;
let beatCounter = 0;

function getNoteDuration(): number {
  return 60 / bpm;
}

function scheduleNote(noteTime: number): void {
  const interval = pattern[currentNoteIndex];
  if (interval === undefined) return;

  // Metronome click on every beat
  if (isMetronomeEnabled) {
    const isDownbeat = beatCounter % 4 === 0;
    playClick(getMetronomeGain(), noteTime, isDownbeat);
    beatCounter++;
  }

  // REST_NOTE: advance time but produce no sound
  if (interval === REST_NOTE) {
    if (callbacks.onNotePlay) {
      const ctx = getAudioContext();
      const delayMs = Math.max(0, (noteTime - ctx.currentTime) * 1000);
      setTimeout(() => {
        callbacks.onNotePlay?.(REST_NOTE, currentNoteIndex);
      }, delayMs);
    }
    return;
  }

  const midiNote = rootNote + interval;
  const duration = getNoteDuration() * 0.9;

  const reverb = getReverbNodes();
  reverb.output.connect(getAccompanimentGain());
  playNote(reverb.input, midiNote, duration, noteTime);

  if (callbacks.onNotePlay) {
    const ctx = getAudioContext();
    const delayMs = Math.max(0, (noteTime - ctx.currentTime) * 1000);
    setTimeout(() => {
      callbacks.onNotePlay?.(midiNote, currentNoteIndex);
    }, delayMs);
  }
}

function advanceNote(): void {
  currentNoteIndex++;

  if (currentNoteIndex >= pattern.length) {
    currentRepeat++;

    if (currentRepeat >= repeatCount) {
      const nextRoot = rootNote + transposeDirection;

      const effectiveEnd = sectionEnd ?? endKey;
      const effectiveStart = sectionStart ?? startKey;

      const pastEnd =
        transposeDirection === 1
          ? nextRoot > effectiveEnd
          : nextRoot < effectiveEnd;

      if (pastEnd) {
        // Section loop: wrap back to start
        if (sectionStart !== null && sectionEnd !== null) {
          rootNote = effectiveStart;
          callbacks.onTranspose?.(rootNote);
          currentRepeat = 0;
          currentNoteIndex = 0;
          nextNoteTime += getNoteDuration();
          return;
        }

        stop();
        callbacks.onComplete?.();
        return;
      }

      rootNote = nextRoot;
      callbacks.onTranspose?.(rootNote);
      currentRepeat = 0;
    }

    currentNoteIndex = 0;
  }

  nextNoteTime += getNoteDuration();
}

function schedulerLoop(): void {
  const ctx = getAudioContext();

  while (nextNoteTime < ctx.currentTime + SCHEDULER_SCHEDULE_AHEAD_S) {
    scheduleNote(nextNoteTime);
    advanceNote();
    if (!isPlaying || isPaused) return;
  }

  timerId = setTimeout(schedulerLoop, SCHEDULER_LOOKAHEAD_MS);
}

export function start(): void {
  if (isPlaying) return;
  if (pattern.length === 0) return;

  isPlaying = true;
  isPaused = false;
  currentNoteIndex = 0;
  currentRepeat = 0;
  beatCounter = 0;

  if (sectionStart !== null) {
    rootNote = sectionStart;
  }

  const ctx = getAudioContext();
  nextNoteTime = ctx.currentTime + 0.05;

  schedulerLoop();
}

export function pause(): void {
  if (!isPlaying || isPaused) return;

  isPaused = true;
  pausedRootNote = rootNote;
  pausedNoteIndex = currentNoteIndex;

  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }

  callbacks.onPause?.();
}

export function resume(): void {
  if (!isPlaying || !isPaused) return;

  isPaused = false;
  rootNote = pausedRootNote;
  currentNoteIndex = pausedNoteIndex;

  const ctx = getAudioContext();
  nextNoteTime = ctx.currentTime + 0.05;

  callbacks.onResume?.();
  schedulerLoop();
}

export function stop(): void {
  isPlaying = false;
  isPaused = false;
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
}

export function getIsPlaying(): boolean {
  return isPlaying;
}

export function getIsPaused(): boolean {
  return isPaused;
}

export function setBpm(newBpm: number): void {
  bpm = newBpm;
}

export function setPattern(newPattern: number[]): void {
  pattern = [...newPattern];
}

export function setRootNote(midi: number): void {
  rootNote = midi;
}

export function setStartKey(midi: number): void {
  startKey = midi;
}

export function setEndKey(midi: number): void {
  endKey = midi;
}

export function setTransposeDirection(dir: 1 | -1): void {
  transposeDirection = dir;
}

export function setRepeatCount(count: number): void {
  repeatCount = Math.max(1, count);
}

export function setCallbacks(cb: SchedulerCallbacks): void {
  callbacks = cb;
}

export function setMetronomeEnabled(enabled: boolean): void {
  isMetronomeEnabled = enabled;
}

export function setSectionRange(
  start: number | null,
  end: number | null,
): void {
  sectionStart = start;
  sectionEnd = end;
}

export function resetToStart(): void {
  const effectiveStart = sectionStart ?? startKey;
  rootNote = effectiveStart;
  currentNoteIndex = 0;
  currentRepeat = 0;
  beatCounter = 0;
}

export function getCurrentRootNote(): number {
  return rootNote;
}
