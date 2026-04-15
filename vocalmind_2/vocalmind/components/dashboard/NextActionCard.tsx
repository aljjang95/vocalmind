'use client';

import Link from 'next/link';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useJourneyStore } from '@/stores/journeyStore';
import { hlbCurriculum } from '@/lib/data/hlbCurriculum';

export default function NextActionCard() {
  const onboardingResult = useOnboardingStore((s) => s.result);
  const { progress, getNextAvailableStage } = useJourneyStore();

  const nextStage = getNextAvailableStage();
  const completedCount = Object.values(progress).filter((p) => p?.status === 'passed').length;

  // 온보딩 미완료
  if (!onboardingResult) {
    return (
      <div className="col-span-full rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.04] p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" fill="var(--accent)" opacity="0.6"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-[var(--text-primary)] m-0">
              무료 상담으로 시작하세요
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1 m-0">
              목소리를 녹음하면 AI가 발성 상태를 분석하고, 맞춤 커리큘럼을 추천합니다.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="shrink-0 px-5 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium no-underline hover:opacity-90 transition-opacity"
          >
            무료 상담 시작
          </Link>
        </div>
      </div>
    );
  }

  // 온보딩 완료, 레슨 미시작
  if (completedCount === 0 && nextStage) {
    const suggestedId = onboardingResult.consultation.suggested_stage_id;
    const targetStage = hlbCurriculum.find((s) => s.id === suggestedId) ?? hlbCurriculum[0];

    return (
      <div className="col-span-full rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.04] p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14M12 5l7 7-7 7" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-[var(--text-primary)] m-0">
              추천 레슨: {targetStage.name}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1 m-0">
              상담 결과를 바탕으로 이 단계부터 시작하는 걸 추천합니다.
            </p>
          </div>
          <Link
            href={`/journey/${targetStage.id}`}
            className="shrink-0 px-5 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium no-underline hover:opacity-90 transition-opacity"
          >
            레슨 시작
          </Link>
        </div>
      </div>
    );
  }

  // 레슨 진행 중
  if (nextStage) {
    const stage = hlbCurriculum.find((s) => s.id === nextStage);
    if (!stage) return null;

    return (
      <div className="col-span-full rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-mono font-bold text-[var(--accent)]">{nextStage}</span>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-[var(--text-primary)] m-0">
              이어서 연습: {stage.name}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1 m-0">
              {completedCount}단계 완료 · {stage.block}
            </p>
          </div>
          <Link
            href={`/journey/${nextStage}`}
            className="shrink-0 px-5 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium no-underline hover:opacity-90 transition-opacity"
          >
            이어서 연습
          </Link>
        </div>
      </div>
    );
  }

  // 전체 완료
  return (
    <div className="col-span-full rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/[0.04] p-6 text-center">
      <h3 className="text-base font-semibold text-[var(--text-primary)] m-0">
        모든 레슨을 완료했습니다!
      </h3>
      <p className="text-sm text-[var(--text-secondary)] mt-1 m-0">
        자유 연습이나 AI 코치와 대화를 이어가세요.
      </p>
    </div>
  );
}
