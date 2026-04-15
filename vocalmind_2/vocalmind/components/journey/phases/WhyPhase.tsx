'use client';

import { useState } from 'react';
import type { HLBCurriculumStage } from '@/types';
import { useTTS } from '@/lib/hooks/useTTS';
import { Button } from '@/components/ui/button';
import { GlowCard } from '@/components/ui/glow-card';
import DemoAudioPlayer from '@/components/shared/DemoAudioPlayer';

interface Props {
  stage: HLBCurriculumStage;
  onNext: () => void;
}

export default function WhyPhase({ stage, onNext }: Props) {
  const tts = useTTS(stage.whyText);
  const [showTtsFallback, setShowTtsFallback] = useState(false);
  const hasAudioUrl = !!stage.whyAudioUrl;

  return (
    <div className="flex flex-col gap-5 min-h-[calc(100vh-180px)] pt-2 pb-6 [&>:last-child]:mt-auto">
      {/* 왜 이 레슨인가 */}
      <GlowCard className="p-5">
        <div className="text-[15px] leading-[1.7] text-white/85">{stage.whyText}</div>
      </GlowCard>

      {hasAudioUrl && !showTtsFallback ? (
        <DemoAudioPlayer
          url={stage.whyAudioUrl!}
          label="선생님 설명"
          onError={() => setShowTtsFallback(true)}
        />
      ) : (
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] text-white/70 bg-white/[0.06] border border-white/[0.12] rounded-lg cursor-pointer transition-all hover:bg-white/10 hover:text-white/90 disabled:opacity-50 disabled:cursor-default"
            onClick={tts.play}
            disabled={tts.isLoading}
          >
            {tts.isLoading ? '로딩...' : tts.isPlaying ? '정지' : '음성으로 듣기'}
          </button>
        </div>
      )}

      {hasAudioUrl && showTtsFallback && (
        <p className="text-xs text-[var(--text-muted)]">음성 파일을 불러올 수 없어 TTS로 재생합니다</p>
      )}

      {/* 이번 레슨 정보 */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1 px-4 py-3.5 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
          <span className="text-[11px] tracking-[0.08em] text-white/35 uppercase">발음</span>
          <span className="text-base font-bold text-white/85">{stage.pronunciation}</span>
        </div>
        <div className="flex flex-col gap-1 px-4 py-3.5 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
          <span className="text-[11px] tracking-[0.08em] text-white/35 uppercase">스케일</span>
          <span className="text-base font-bold text-white/85">{stage.scaleType}</span>
        </div>
        <div className="flex flex-col gap-1 px-4 py-3.5 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
          <span className="text-[11px] tracking-[0.08em] text-white/35 uppercase">합격 기준</span>
          <span className="text-base font-bold text-white/85">{stage.evaluationCriteria.passingScore}점</span>
        </div>
        <div className="flex flex-col gap-1 px-4 py-3.5 bg-white/[0.03] border border-white/[0.07] rounded-[10px]">
          <span className="text-[11px] tracking-[0.08em] text-white/35 uppercase">BPM</span>
          <span className="text-base font-bold text-white/85">
            {stage.bpmRange[0] === 0 && stage.bpmRange[1] === 0
              ? '자유'
              : stage.bpmRange[0] === stage.bpmRange[1]
                ? `${stage.bpmRange[0]}`
                : `${stage.bpmRange[0]}~${stage.bpmRange[1]}`}
          </span>
        </div>
      </div>

      {/* 목표 */}
      <div className="px-5 py-4 bg-emerald-400/[0.06] border border-emerald-400/20 rounded-xl">
        <div className="text-[11px] font-semibold tracking-[0.08em] text-emerald-400/70 uppercase mb-1.5">이번 레슨 목표</div>
        <p className="text-sm leading-relaxed text-white/75">{stage.evaluationCriteria.description}</p>
      </div>

      {/* 관찰 질문 */}
      <div className="text-lg text-[var(--text-primary)] p-4 bg-indigo-500/[0.08] border border-indigo-500/20 rounded-[10px] text-sm text-indigo-300/90">
        {stage.somaticFeedback.observationQuestion}
      </div>

      <Button variant="default" className="w-full" onClick={onNext}>
        시범 보기
      </Button>
    </div>
  );
}
