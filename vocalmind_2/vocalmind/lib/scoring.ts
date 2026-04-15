/**
 * Scoring algorithm for Play mode.
 * Compares user pitch data against reference melody and produces a SessionScore.
 */

import type { MelodyPoint, SongSection, SessionScore } from '@/types';
import { SEMITONES_PER_OCTAVE } from '@/lib/audio/constants';

// ── cent 차이 계산 ──

/**
 * Calculate the absolute cent difference between two frequencies.
 * Returns Infinity if either frequency is 0 (silence).
 */
function centsBetween(freqA: number, freqB: number): number {
  if (freqA <= 0 || freqB <= 0) return Infinity;
  return Math.abs(1200 * Math.log2(freqA / freqB));
}

/**
 * Convert a cent difference to a score (0~100).
 *   |cents| <= 15: 100%
 *   |cents| <= 30: 80%
 *   |cents| <= 50: 50%
 *   |cents| >  50: 0%
 */
function centsToScore(cents: number): number {
  if (cents <= 15) return 100;
  if (cents <= 30) return 80;
  if (cents <= 50) return 50;
  return 0;
}

// ── 시간축 매칭 ──

/**
 * Find the closest reference point for a given time.
 * Uses binary search for efficiency.
 */
function findClosestReference(time: number, reference: MelodyPoint[]): MelodyPoint | null {
  if (reference.length === 0) return null;

  let low = 0;
  let high = reference.length - 1;

  while (low < high) {
    const mid = (low + high) >> 1;
    if (reference[mid].time < time) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  // Check both low and low-1 to find the actual closest
  if (low > 0) {
    const diffPrev = Math.abs(reference[low - 1].time - time);
    const diffCurr = Math.abs(reference[low].time - time);
    return diffPrev < diffCurr ? reference[low - 1] : reference[low];
  }

  return reference[low];
}

// ── 채점 ──

/**
 * Calculate a session score by comparing user pitch data against reference melody.
 *
 * @param userPitch - User's recorded pitch data (MelodyPoint[])
 * @param referenceMelody - Reference melody from song analysis (MelodyPoint[])
 * @param songId - ID of the song being scored
 * @param keyShift - Key shift applied during playback
 * @param sections - Optional song sections for per-section scoring
 * @returns A SessionScore object
 */
export function calculateScore(
  userPitch: MelodyPoint[],
  referenceMelody: MelodyPoint[],
  songId: string,
  keyShift: number,
  sections?: SongSection[],
): SessionScore {
  // Apply key shift to reference melody frequencies
  const shiftedReference = referenceMelody.map((point) => {
    if (point.frequency <= 0) return point;
    const shiftedFreq = point.frequency * Math.pow(2, keyShift / SEMITONES_PER_OCTAVE);
    return { ...point, frequency: shiftedFreq };
  });

  // Score each user pitch point
  const pointScores: { time: number; score: number; sectionIndex: number }[] = [];

  for (const userPoint of userPitch) {
    // Skip silence from user
    if (userPoint.frequency <= 0) continue;

    const refPoint = findClosestReference(userPoint.time, shiftedReference);
    if (!refPoint || refPoint.frequency <= 0) continue;

    // Only match if within 100ms of each other
    if (Math.abs(refPoint.time - userPoint.time) > 0.1) continue;

    const cents = centsBetween(userPoint.frequency, refPoint.frequency);
    const score = centsToScore(cents);

    // Determine which section this point belongs to
    let sectionIndex = -1;
    if (sections) {
      for (let i = 0; i < sections.length; i++) {
        if (userPoint.time >= sections[i].startTime && userPoint.time <= sections[i].endTime) {
          sectionIndex = i;
          break;
        }
      }
    }

    pointScores.push({ time: userPoint.time, score, sectionIndex });
  }

  // Calculate overall score
  const overallScore =
    pointScores.length > 0
      ? Math.round(pointScores.reduce((sum, p) => sum + p.score, 0) / pointScores.length)
      : 0;

  // Calculate section scores
  const sectionScores: { sectionIndex: number; score: number }[] = [];
  if (sections) {
    for (let i = 0; i < sections.length; i++) {
      const sectionPoints = pointScores.filter((p) => p.sectionIndex === i);
      if (sectionPoints.length > 0) {
        const avg = Math.round(
          sectionPoints.reduce((sum, p) => sum + p.score, 0) / sectionPoints.length,
        );
        sectionScores.push({ sectionIndex: i, score: avg });
      } else {
        sectionScores.push({ sectionIndex: i, score: 0 });
      }
    }
  }

  // Calculate duration
  const duration =
    userPitch.length > 0
      ? userPitch[userPitch.length - 1].time - userPitch[0].time
      : 0;

  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    songId,
    playedAt: new Date().toISOString(),
    keyShift,
    overallScore,
    sectionScores,
    userPitchData: userPitch,
    duration,
  };
}
