'use client';

import Link from 'next/link';
import { useJourneyStore } from '@/stores/journeyStore';
import { hlbCurriculum } from '@/lib/data/hlbCurriculum';
import { GlowCard } from '@/components/ui/glow-card';
import { Button } from '@/components/ui/button';

type Recommendation = {
  label: string;
  description: string;
  icon: string;
  href: string;
  buttonText: string;
};

export default function TodayPractice() {
  const progress = useJourneyStore((s) => s.progress);
  const getNextAvailableStage = useJourneyStore((s) => s.getNextAvailableStage);

  const recommendation = getRecommendation(progress, getNextAvailableStage);

  return (
    <GlowCard className="p-6 flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">오늘 할 연습</h2>

      <div className="flex gap-3.5 items-start p-4 bg-white/[0.03] rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
        <span className="text-2xl leading-none shrink-0 mt-0.5">{recommendation.icon}</span>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[0.95rem] font-semibold text-[var(--text-primary)]">{recommendation.label}</span>
          <p className="text-sm text-[var(--text-secondary)] m-0 leading-relaxed">{recommendation.description}</p>
        </div>
      </div>

      <Link href={recommendation.href} className="no-underline mt-auto block">
        <Button variant="default" className="w-full">
          {recommendation.buttonText}
        </Button>
      </Link>
    </GlowCard>
  );
}

function getRecommendation(
  progress: Record<number, { status: string; bestScore: number; stageId: number }>,
  getNextAvailableStage: () => number | null,
): Recommendation {
  const hasAnyProgress = Object.keys(progress).length > 0;

  // 아직 시작하지 않은 경우
  if (!hasAnyProgress) {
    return {
      label: '첫 상담부터 시작하세요',
      description: '보컬 상태를 진단하고 맞춤 커리큘럼을 받아보세요.',
      icon: '🎤',
      href: '/onboarding',
      buttonText: '상담 시작',
    };
  }

  // 최근 불통과한 스테이지 찾기 (in_progress 상태 중 시도 횟수가 있는 것)
  const failedStages = Object.values(progress)
    .filter((p) => p.status === 'in_progress')
    .sort((a, b) => b.stageId - a.stageId);

  if (failedStages.length > 0) {
    const failedId = failedStages[0].stageId;
    const stage = hlbCurriculum.find((s) => s.id === failedId);
    if (stage) {
      return {
        label: `${stage.blockIcon} ${stage.name} 재도전`,
        description: `이전에 ${failedStages[0].bestScore}점이었어요. 다시 도전해보세요.`,
        icon: stage.blockIcon,
        href: `/journey/${failedId}`,
        buttonText: '재도전하기',
      };
    }
  }

  // 다음 진행할 스테이지
  const nextId = getNextAvailableStage();
  if (nextId) {
    const stage = hlbCurriculum.find((s) => s.id === nextId);
    if (stage) {
      return {
        label: `${stage.blockIcon} ${stage.name}`,
        description: `${stage.block} 블록의 새로운 레슨이에요.`,
        icon: stage.blockIcon,
        href: `/journey/${nextId}`,
        buttonText: '연습 시작',
      };
    }
  }

  // 모든 스테이지 완료
  const totalPassed = Object.values(progress).filter((p) => p.status === 'passed').length;
  if (totalPassed === hlbCurriculum.length) {
    // 가장 낮은 점수 스테이지 추천
    const lowestScore = Object.values(progress)
      .filter((p) => p.status === 'passed')
      .sort((a, b) => a.bestScore - b.bestScore)[0];
    const lowestStage = lowestScore
      ? hlbCurriculum.find((s) => s.id === lowestScore.stageId)
      : null;

    if (lowestStage && lowestScore) {
      return {
        label: `${lowestStage.blockIcon} ${lowestStage.name} 복습`,
        description: `점수가 가장 낮은 레슨(${lowestScore.bestScore}점)을 복습해보세요.`,
        icon: lowestStage.blockIcon,
        href: `/journey/${lowestStage.id}`,
        buttonText: '복습하기',
      };
    }
  }

  // fallback
  return {
    label: '자유 연습',
    description: '소리의 길에서 원하는 레슨을 선택하세요.',
    icon: '🎵',
    href: '/journey',
    buttonText: '연습실 가기',
  };
}
