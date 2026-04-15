/**
 * Real-time pitch grading for AI Coach lesson mode.
 * Scores individual notes by comparing detected frequency against expected MIDI pitch.
 */

import { midiToFrequency } from '@/lib/audio/musicUtils';
import type { NoteScore, PatternScore } from '@/types';

/**
 * Grade a single pitch detection against an expected MIDI note.
 *
 * Scoring thresholds:
 *   |cents| <= 15 : 100 points
 *   |cents| <= 30 : 80 points
 *   |cents| <= 50 : 50 points
 *   |cents| >  50 : 0 points
 *   frequency = 0 : 0 points (silence / no detection)
 */
export function gradePitch(
  expectedMidi: number,
  detectedFrequency: number,
  noteIndex: number
): NoteScore {
  if (detectedFrequency <= 0) {
    return {
      noteIndex,
      expectedMidi,
      detectedFrequency: 0,
      cents: Infinity,
      score: 0,
    };
  }

  const expectedFreq = midiToFrequency(expectedMidi);
  const cents = Math.abs(1200 * Math.log2(detectedFrequency / expectedFreq));

  let score: number;
  if (cents <= 15) {
    score = 100;
  } else if (cents <= 30) {
    score = 80;
  } else if (cents <= 50) {
    score = 50;
  } else {
    score = 0;
  }

  return {
    noteIndex,
    expectedMidi,
    detectedFrequency,
    cents: Math.round(cents * 100) / 100,
    score,
  };
}

/**
 * Calculate average score for a pattern (series of notes at one transposition).
 */
export function gradePattern(noteScores: NoteScore[]): number {
  if (noteScores.length === 0) return 0;
  const sum = noteScores.reduce((acc, ns) => acc + ns.score, 0);
  return Math.round(sum / noteScores.length);
}

/**
 * Calculate overall lesson score from all pattern scores.
 */
export function gradeLesson(patternScores: PatternScore[]): number {
  if (patternScores.length === 0) return 0;
  const sum = patternScores.reduce((acc, ps) => acc + ps.average, 0);
  return Math.round(sum / patternScores.length);
}
