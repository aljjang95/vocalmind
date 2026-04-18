/**
 * 단계별 다축 채점 — stage.evaluationCriteria.metrics 선언대로 계산.
 *
 * 각 단계가 요구하는 metrics만 계산해 가중평균을 낸다:
 *   - tone_stability: 100 - avg_tension (긴장 낮을수록 높음)
 *   - pitch_accuracy: pitch_history 샘플을 stage.pattern에 매핑해 cent 오차 기반 점수
 *   - rhythm_score:   선택적으로 제공 (현 journey 미지원, F2 후속)
 *
 * cent 임계값(2026 업계 표준):
 *   - ≤15: 우수 / ≤30: 양호 / ≤50: 보통 / >50: 불량
 *   - 300cent(단3도) 초과는 최대 오차로 클램프 → 선형 보간 (backend scoring.py와 동일)
 */

import type { HLBCurriculumStage, EvaluationMetric } from '@/types';

export interface StageScoreBreakdown {
  score: number;
  toneStability: number;
  pitchAccuracy: number;
  pitchEvaluated: boolean;
  rhythmScore: number | null;
  weights: Record<EvaluationMetric, number>;
  axisScores: Partial<Record<EvaluationMetric, number>>;
}

const C4_HZ = 261.6255653005986;
const MAX_CENT_ERROR = 300;

/** 세미톤 배열 → 목표 주파수 배열 (C4 기준). */
export function patternToTargetFreqs(pattern: number[]): number[] {
  return pattern.map((semitone) => C4_HZ * Math.pow(2, semitone / 12));
}

/**
 * 각 감지 피치를 가장 가까운 목표음에 매핑 → 평균 cent 오차 → 0~100 점수.
 * 세션 중 패턴을 여러 번 반복하므로 1:1 매핑 대신 "최단 거리 목표음" 사용.
 */
export function computePitchAccuracy(pitchHistory: number[], pattern: number[]): number {
  const targets = patternToTargetFreqs(pattern);
  if (targets.length === 0 || pitchHistory.length === 0) return 0;

  const validPitches = pitchHistory.filter((p) => p > 0);
  if (validPitches.length === 0) return 0;

  const centErrors = validPitches.map((pitch) => {
    let minCents = Infinity;
    for (const target of targets) {
      const cents = Math.abs(1200 * Math.log2(pitch / target));
      if (cents < minCents) minCents = cents;
    }
    return Math.min(minCents, MAX_CENT_ERROR);
  });

  const meanError = centErrors.reduce((sum, v) => sum + v, 0) / centErrors.length;
  const score = Math.max(0, (1 - meanError / MAX_CENT_ERROR) * 100);
  return Math.round(score);
}

/** 단계 정의 + 세션 결과 → metrics 선언대로 가중평균 점수. */
export function computeStageScore(params: {
  stage: HLBCurriculumStage;
  avgTension: number;
  pitchHistory: number[];
  rhythmScore?: number | null;
}): StageScoreBreakdown {
  const { stage, avgTension, pitchHistory, rhythmScore = null } = params;
  const metrics = stage.evaluationCriteria.metrics;

  const toneStability = Math.max(0, Math.min(100, Math.round(100 - avgTension)));
  const pitchEvaluated =
    metrics.includes('pitch_accuracy') &&
    stage.pattern.length > 0 &&
    pitchHistory.length > 0;
  const pitchAccuracy = pitchEvaluated
    ? computePitchAccuracy(pitchHistory, stage.pattern)
    : 0;

  const axisScores: Partial<Record<EvaluationMetric, number>> = {};
  if (metrics.includes('tone_stability')) {
    axisScores.tone_stability = toneStability;
  }
  if (pitchEvaluated) {
    axisScores.pitch_accuracy = pitchAccuracy;
  }
  if (metrics.includes('rhythm_score') && typeof rhythmScore === 'number') {
    axisScores.rhythm_score = rhythmScore;
  }

  // 활성 축이 없으면 toneStability로 fallback
  const measured = Object.keys(axisScores) as EvaluationMetric[];
  const active: EvaluationMetric[] =
    measured.length > 0 ? measured : ['tone_stability'];
  if (measured.length === 0) {
    axisScores.tone_stability = toneStability;
  }

  const weight = 1 / active.length;
  const weights = {} as Record<EvaluationMetric, number>;
  for (const axis of active) weights[axis] = weight;

  const score = Math.round(
    active.reduce((sum, axis) => sum + (axisScores[axis] ?? 0) * weight, 0),
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    toneStability,
    pitchAccuracy,
    pitchEvaluated,
    rhythmScore,
    weights,
    axisScores,
  };
}
