/**
 * Lesson engine for AI Coach.
 *
 * Wraps the scheduler and pitch detector to synchronize pattern playback
 * with real-time pitch collection and grading.
 */

import * as scheduler from '@/lib/audio/scheduler';
import { startPitchDetection, stopPitchDetection } from '@/lib/audio/pitchDetector';
import { resumeAudioContext } from '@/lib/audio/audioEngine';
import { getStageById } from '@/lib/data/hlbCurriculum';
import { gradePitch, gradePattern, gradeLesson } from '@/lib/coach/pitchGrader';
import { REST_NOTE } from '@/lib/audio/constants';
import type { PitchData } from '@/lib/audio/pitchDetector';
import type { NoteScore, PatternScore } from '@/types';

export interface LessonCallbacks {
  onNotePlay?: (midiNote: number, noteIndex: number) => void;
  onKeyChange?: (newRoot: number) => void;
  onPatternComplete?: (patternScore: PatternScore) => void;
  onLessonComplete?: (score: number, patternScores: PatternScore[]) => void;
}

// ── Internal state ──

let expectedMidi: number = 0;
let currentNoteIndex: number = 0;
let pitchSamples: PitchData[] = [];
let currentPatternNoteScores: NoteScore[] = [];
let allPatternScores: PatternScore[] = [];
let currentRootNote: number = 0;
let currentPattern: number[] = [];
let isLessonActive: boolean = false;
let lessonCallbacks: LessonCallbacks = {};

/**
 * Finalize the score for the previously playing note using collected pitch samples.
 * If no samples were collected, the note scores 0 (silence).
 */
function finalizeCurrentNote(): void {
  if (expectedMidi <= 0) return;

  let noteScore: NoteScore;

  if (pitchSamples.length === 0) {
    noteScore = {
      noteIndex: currentNoteIndex,
      expectedMidi,
      detectedFrequency: 0,
      cents: Infinity,
      score: 0,
    };
  } else {
    // Use the median frequency for stability
    const sorted = [...pitchSamples].sort((a, b) => a.frequency - b.frequency);
    const medianFreq = sorted[Math.floor(sorted.length / 2)].frequency;
    noteScore = gradePitch(expectedMidi, medianFreq, currentNoteIndex);
  }

  currentPatternNoteScores.push(noteScore);
  pitchSamples = [];
}

/**
 * Finalize the current pattern's scores and store as a PatternScore.
 */
function finalizeCurrentPattern(): PatternScore {
  const average = gradePattern(currentPatternNoteScores);
  const patternScore: PatternScore = {
    rootNote: currentRootNote,
    noteScores: [...currentPatternNoteScores],
    average,
  };
  allPatternScores.push(patternScore);
  currentPatternNoteScores = [];
  return patternScore;
}

/**
 * Start a lesson for the given stage.
 *
 * @param stageId   - HLB curriculum stage ID
 * @param bpm       - Beats per minute
 * @param startKey  - Starting root MIDI note
 * @param keyRange  - Number of semitones to traverse upward from startKey
 * @param callbacks - Callbacks for UI updates
 */
export async function startLesson(
  stageId: number,
  bpm: number,
  startKey: number,
  keyRange: number,
  callbacks: LessonCallbacks
): Promise<void> {
  if (typeof window === 'undefined') return;

  // Stop any previous playback
  scheduler.stop();
  stopPitchDetection();

  const stage = getStageById(stageId);
  if (!stage || stage.pattern.length === 0) return;

  // Reset internal state
  expectedMidi = 0;
  currentNoteIndex = 0;
  pitchSamples = [];
  currentPatternNoteScores = [];
  allPatternScores = [];
  currentRootNote = startKey;
  currentPattern = stage.pattern;
  isLessonActive = true;
  lessonCallbacks = callbacks;

  // Configure scheduler
  scheduler.setPattern(stage.pattern);
  scheduler.setBpm(bpm);
  scheduler.setRootNote(startKey);
  scheduler.setStartKey(startKey);
  scheduler.setEndKey(startKey + keyRange);
  scheduler.setTransposeDirection(1);
  scheduler.setRepeatCount(1);
  scheduler.setSectionRange(null, null);

  scheduler.setCallbacks({
    onNotePlay: (midiNote: number, index: number) => {
      // Finalize the previous note's pitch data
      if (expectedMidi > 0) {
        finalizeCurrentNote();
      }

      // Set up for the new note
      if (midiNote === REST_NOTE) {
        expectedMidi = 0;
      } else {
        expectedMidi = midiNote;
      }
      currentNoteIndex = index;
      pitchSamples = [];

      callbacks.onNotePlay?.(midiNote, index);
    },

    onTranspose: (newRoot: number) => {
      // Finalize the last note of the current pattern
      if (expectedMidi > 0) {
        finalizeCurrentNote();
        expectedMidi = 0;
      }

      // Finalize the current pattern
      const patternScore = finalizeCurrentPattern();
      callbacks.onPatternComplete?.(patternScore);

      // Update root note for next pattern
      currentRootNote = newRoot;
      callbacks.onKeyChange?.(newRoot);
    },

    onComplete: () => {
      // Finalize the last note
      if (expectedMidi > 0) {
        finalizeCurrentNote();
        expectedMidi = 0;
      }

      // Finalize the last pattern
      if (currentPatternNoteScores.length > 0) {
        const patternScore = finalizeCurrentPattern();
        callbacks.onPatternComplete?.(patternScore);
      }

      // Calculate overall lesson score
      const lessonScore = gradeLesson(allPatternScores);

      isLessonActive = false;
      stopPitchDetection();

      callbacks.onLessonComplete?.(lessonScore, [...allPatternScores]);
    },
  });

  // Start microphone pitch detection
  await resumeAudioContext();
  await startPitchDetection(collectPitch);

  // Start scheduler playback
  scheduler.start();
}

/**
 * Collect a pitch sample from the pitch detector.
 * Ignores low-confidence readings (confidence < 0.5).
 */
export function collectPitch(pitchData: PitchData): void {
  if (!isLessonActive) return;
  if (pitchData.confidence < 0.5) return;
  if (expectedMidi <= 0) return;

  pitchSamples.push(pitchData);
}

/**
 * Stop the current lesson immediately.
 * Cleans up scheduler and pitch detection.
 */
export function stopLesson(): void {
  isLessonActive = false;
  expectedMidi = 0;
  scheduler.stop();
  stopPitchDetection();
}

/**
 * Check whether a lesson is currently active.
 */
export function isLessonRunning(): boolean {
  return isLessonActive;
}

/**
 * Get the all pattern scores collected so far (for mid-lesson UI updates).
 */
export function getCurrentPatternScores(): PatternScore[] {
  return [...allPatternScores];
}
