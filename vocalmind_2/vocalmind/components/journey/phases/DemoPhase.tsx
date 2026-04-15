'use client';

import { useState } from 'react';
import type { HLBCurriculumStage } from '@/types';
import { useTTS } from '@/lib/hooks/useTTS';
import { Button } from '@/components/ui/button';
import { GlowCard } from '@/components/ui/glow-card';
import DemoAudioPlayer from '@/components/shared/DemoAudioPlayer';
import YouTubePlayer from '@/components/journey/YouTubePlayer';

interface Props {
  stage: HLBCurriculumStage;
  onNext: () => void;
}

export default function DemoPhase({ stage, onNext }: Props) {
  const tts = useTTS(stage.demoScript);
  const [showTtsFallback, setShowTtsFallback] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const hasAudioUrl = !!stage.demoAudioUrl;
  const hasVideoId = !!stage.demoVideoId && !videoError;

  return (
    <div className="flex flex-col gap-5 min-h-[calc(100vh-180px)] pt-2 pb-6 [&>:last-child]:mt-auto">
      {/* 시범 영상 (YouTube 임베드) */}
      {hasVideoId && (
        <YouTubePlayer
          videoId={stage.demoVideoId!}
          startSec={stage.demoStartSec}
          endSec={stage.demoEndSec}
          onError={() => setVideoError(true)}
        />
      )}

      <GlowCard className="p-6 text-center">
        <p className="text-[15px] leading-[1.7] text-white/85 mb-5">{stage.demoScript}</p>

        {hasAudioUrl && !showTtsFallback ? (
          <DemoAudioPlayer
            url={stage.demoAudioUrl!}
            label="선생님 시범"
            onError={() => setShowTtsFallback(true)}
          />
        ) : (
          <button
            className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--accent)] border-none cursor-pointer transition-all text-white text-2xl hover:scale-105 hover:shadow-[0_4px_20px_rgba(59,130,246,0.3)] disabled:opacity-50 disabled:cursor-default disabled:transform-none"
            onClick={tts.play}
            disabled={tts.isLoading}
            aria-label="시범 음성 재생"
          >
            {tts.isLoading ? '...' : tts.isPlaying ? '||' : '\u25B6'}
          </button>
        )}

        {hasAudioUrl && showTtsFallback && (
          <p className="text-xs text-[var(--text-muted)] mt-2">음성 파일을 불러올 수 없어 TTS로 재생합니다</p>
        )}
      </GlowCard>

      <p className="text-sm text-white/60 text-center mt-1">이제 직접 해볼까요?</p>

      <Button variant="default" className="w-full" onClick={onNext}>
        실습 시작
      </Button>
    </div>
  );
}
