/**
 * Progress management logic for AI Coach.
 * All functions are pure -- no side effects, no browser dependencies.
 */

import type { CoachCondition } from '@/types';

/**
 * Judge whether a lesson attempt passes.
 * Default threshold: 80 points.
 */
export function judgeLesson(
  score: number,
  passThreshold: number = 80
): { passed: boolean } {
  return { passed: score >= passThreshold };
}

/**
 * Determine whether the BPM should be lowered after consecutive failures.
 * Returns true if failStreak >= 3.
 */
export function shouldLowerBpm(failStreak: number): boolean {
  return failStreak >= 3;
}

/**
 * Calculate a reduced BPM value (10% decrease), clamped to bpmMin.
 */
export function calculateNewBpm(currentBpm: number, bpmMin: number): number {
  return Math.max(bpmMin, Math.round(currentBpm * 0.9));
}

/**
 * Determine whether the session should end due to too many consecutive failures.
 * Returns true if failStreak >= 5.
 */
export function shouldEndSession(failStreak: number): boolean {
  return failStreak >= 5;
}

/**
 * Get the key range (in semitones) based on the user's reported condition.
 *   good:   12 semitones (full octave)
 *   normal:  9 semitones
 *   tired:   6 semitones
 *   bad:     4 semitones
 */
export function getKeyRange(condition: CoachCondition): number {
  switch (condition) {
    case 'good':
      return 12;
    case 'normal':
      return 9;
    case 'tired':
      return 6;
    case 'bad':
      return 4;
  }
}
