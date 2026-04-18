'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { HLBCurriculumStage } from '@/types';
import type { SessionReport, TensionData } from '@/lib/hooks/useRealtimeEval';
import { useJourneyStore } from '@/stores/journeyStore';
import SessionReportPanel from '@/components/journey/SessionReportPanel';
import { Button } from '@/components/ui/button';
import { GlowCard } from '@/components/ui/glow-card';
import { computeStageScore } from '@/lib/coach/stageScore';

interface Props {
  stage: HLBCurriculumStage;
  stageId: number;
  report: SessionReport;
  tensionHistory: TensionData[];
  onNext: () => void;
}

// 동일 부위 3회 연속 실패 시 기초 단계 유도
const AREA_TO_FOUNDATION_STAGE: Record<string, { stageId: number; name: string }> = {
  '후두': { stageId: 2, name: '후두 안정' },
  '혀뿌리': { stageId: 1, name: '설근 안정화' },
  '턱': { stageId: 7, name: '모음 5개 라운딩' },
  '성구전환': { stageId: 5, name: '허밍 세팅' },
};

function detectRepeatedWeakArea(recentIssues: string[] | undefined): string | null {
  if (!recentIssues || recentIssues.length < 3) return null;
  const last3 = recentIssues.slice(-3);
  // 각 세션 문자열을 "+"로 split해 부위 목록 만들고, 3세션 모두에 등장한 부위 탐색
  const areaSets = last3.map((s) => new Set(s.split('+').filter(Boolean)));
  if (areaSets.some((set) => set.size === 0)) return null;
  const commonAreas = Array.from(areaSets[0]).filter((a) => areaSets[1].has(a) && areaSets[2].has(a));
  return commonAreas[0] ?? null;
}

export default function EvalPhase({ stage, stageId, report, tensionHistory, onNext }: Props) {
  const router = useRouter();
  const { submitEvaluation, progress } = useJourneyStore();
  const submittedRef = useRef(false);
  const [ragFeedback, setRagFeedback] = useState<string | null>(null);

  const prog = progress[stageId];

  // 다축 채점 결과 (score, axisScores 등) — 메모이즈해서 UI 표시에도 재사용
  const breakdown = useMemo(() => {
    const avgTension = report.stats?.avg_tension ?? 0;
    const pitchHistory = report.stats?.pitch_history ?? [];
    return computeStageScore({ stage, avgTension, pitchHistory });
  }, [report, stage]);

  useEffect(() => {
    if (submittedRef.current) return;
    if (!report.stats) return;
    submittedRef.current = true;

    const avgTension = report.stats.avg_tension;
    const { score, toneStability, pitchAccuracy, pitchEvaluated } = breakdown;
    const passed =
      score >= stage.evaluationCriteria.passingScore && report.stats.chunk_count >= 3;

    // 부위별 평균 긴장도 계산 (실제 tensionHistory 기반)
    const avgByAxis = (key: keyof TensionData) => {
      if (tensionHistory.length === 0) return 0;
      const vals = tensionHistory.map((t) => Number(t[key]) || 0);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const tensionDetail = report.stats.main_issues?.join(', ') || '이완 상태';

    submitEvaluation(stageId, {
      score,
      pitchAccuracy,
      toneStability,
      tensionDetected: report.stats.tension_events > 0,
      tension: {
        overall: avgTension,
        laryngeal: avgByAxis('laryngeal'),
        tongue_root: avgByAxis('tongue_root'),
        jaw: avgByAxis('jaw'),
        register_break: avgByAxis('register_break'),
        detail: tensionDetail,
      },
      feedback: report.summary,
      passed,
      mainIssues: report.stats.main_issues ?? [],
    });

    // RAG 코칭 — pitch 평가 여부를 score와 함께 전달해 선생님 사례 검색 정확도 향상
    fetch('/api/journey-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stage_id: stageId,
        user_message: tensionDetail,
        score,
        pitch_accuracy: pitchEvaluated ? pitchAccuracy : score,
        tension_detail: tensionDetail,
      }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.feedback) setRagFeedback(data.feedback); })
      .catch(() => {});
  }, [report, stage, stageId, submitEvaluation, tensionHistory, breakdown]);

  const axisLabels: Record<string, string> = {
    tone_stability: '톤 안정',
    pitch_accuracy: '음정 정확도',
    rhythm_score: '박자',
  };

  // 이번 세션이 실패했고, 최근 3회 같은 부위가 반복되면 기초 단계 재점검 유도
  const currentFailed =
    breakdown.score < stage.evaluationCriteria.passingScore ||
    (report.stats?.chunk_count ?? 0) < 3;
  const repeatedWeakArea = detectRepeatedWeakArea(prog?.recentIssues);
  const foundationSuggestion =
    currentFailed && repeatedWeakArea && repeatedWeakArea !== stage.name
      ? AREA_TO_FOUNDATION_STAGE[repeatedWeakArea]
      : null;

  return (
    <div className="flex flex-col gap-4">
      <SessionReportPanel report={report} tensionHistory={tensionHistory} />

      {/* 축별 점수 breakdown — 단계가 선언한 metrics만 표시 */}
      <GlowCard className="p-4">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-[11px] font-semibold tracking-wide uppercase text-white/50">
            종합 점수
          </span>
          <span className="text-2xl font-extrabold text-white">
            {breakdown.score}
            <span className="text-xs text-white/40 font-medium ml-1">
              / {stage.evaluationCriteria.passingScore} 통과
            </span>
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {(Object.keys(breakdown.axisScores) as Array<keyof typeof axisLabels>).map((axis) => {
            const value = breakdown.axisScores[axis as keyof typeof breakdown.axisScores] ?? 0;
            return (
              <div key={axis} className="flex items-center gap-3">
                <span className="text-xs text-white/60 min-w-[76px]">{axisLabels[axis] ?? axis}</span>
                <div className="flex-1 h-1.5 bg-white/[0.06] rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-emerald-400/80 rounded-sm transition-[width] duration-500"
                    style={{ width: `${value}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-white/85 min-w-[28px] text-right font-[Inter,monospace]">
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      </GlowCard>

      {foundationSuggestion && foundationSuggestion.stageId !== stageId && (
        <GlowCard className="p-4 border-l-[3px] border-l-orange-400">
          <div className="text-[11px] font-semibold text-orange-300 uppercase tracking-wide mb-1.5">
            기초 재점검 권장
          </div>
          <p className="text-sm text-white/80 leading-relaxed mb-3">
            최근 3회 세션에서 <strong>{repeatedWeakArea}</strong> 부위 긴장이 반복됩니다.
            {' '}
            <strong>{foundationSuggestion.stageId}단계 ({foundationSuggestion.name})</strong>에서
            해당 부위 세팅을 다시 다진 뒤 돌아오면 훨씬 수월합니다.
          </p>
          <button
            type="button"
            className="text-xs px-4 py-1.5 bg-orange-500/20 text-orange-200 border border-orange-400/40 rounded-md font-semibold hover:bg-orange-500/30 transition-colors"
            onClick={() => router.push(`/journey/${foundationSuggestion.stageId}`)}
          >
            {foundationSuggestion.stageId}단계로 이동
          </button>
        </GlowCard>
      )}

      {ragFeedback && (
        <GlowCard className="p-3 px-4 border-l-[3px] border-l-[var(--accent)]">
          <span className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-wide">선생님 코칭</span>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-1.5 m-0">{ragFeedback}</p>
        </GlowCard>
      )}

      <Button variant="default" className="w-full" onClick={onNext}>
        요약 보기
      </Button>
    </div>
  );
}
