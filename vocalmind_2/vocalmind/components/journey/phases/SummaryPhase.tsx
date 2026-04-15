'use client';

import { useRouter } from 'next/navigation';
import type { HLBCurriculumStage } from '@/types';
import { useJourneyStore } from '@/stores/journeyStore';
import { Button } from '@/components/ui/button';
import { GlowCard } from '@/components/ui/glow-card';

interface Props {
  stage: HLBCurriculumStage;
  stageId: number;
  passed: boolean;
  onRetry: () => void;
}

export default function SummaryPhase({ stage, stageId, passed, onRetry }: Props) {
  const router = useRouter();
  const { progress } = useJourneyStore();
  const prog = progress[stageId];

  const feedbackText = passed
    ? stage.somaticFeedback.onSuccess
    : stage.somaticFeedback.onStruggle;

  const nextStageId = stageId + 1;
  const isLastStage = stageId >= 28;

  return (
    <div className="flex flex-col gap-5">
      <GlowCard className={`p-6 text-center ${passed ? 'border-emerald-500/20' : 'border-orange-400/20'}`}>
        <h2 className={`text-lg font-bold mb-3 ${passed ? 'text-emerald-300' : 'text-orange-300'}`}>
          {passed && isLastStage ? '전 과정을 완료했어요!' : passed ? '통과' : '다시 도전해보세요'}
        </h2>
        <p className="text-sm leading-[1.7] text-white/80">{feedbackText}</p>
        {passed && isLastStage && (
          <p className="text-sm leading-[1.7] text-white/80">28단계 전체를 마쳤어요. 정말 대단해요!</p>
        )}
      </GlowCard>

      {prog && (
        <div className="flex justify-center gap-8 py-3">
          <div className="text-center">
            <div className="text-xl font-bold text-white/90">{prog.bestScore}</div>
            <div className="text-[11px] text-white/40 mt-0.5">최고 점수</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-white/90">{prog.attempts}</div>
            <div className="text-[11px] text-white/40 mt-0.5">시도 횟수</div>
          </div>
        </div>
      )}

      {passed && !isLastStage ? (
        <Button
          variant="default"
          className="w-full"
          onClick={() => router.push(`/journey/${nextStageId}`)}
        >
          다음 레슨
        </Button>
      ) : !passed ? (
        <Button variant="default" className="w-full" onClick={onRetry}>
          다시 연습
        </Button>
      ) : null}

      <Button
        variant="ghost"
        className="w-full"
        onClick={() => router.push('/journey')}
      >
        여정으로 돌아가기
      </Button>
    </div>
  );
}
