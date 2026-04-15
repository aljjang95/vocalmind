'use client';

import { useEffect } from 'react';
import { useYouTubePlayer } from '@/lib/hooks/useYouTubePlayer';

interface Props {
  videoId: string;
  startSec?: number;
  endSec?: number;
  onError?: () => void;
}

export default function YouTubePlayer({ videoId, startSec, endSec, onError }: Props) {
  const { containerRef, isReady, replay, error } = useYouTubePlayer(videoId, startSec, endSec);

  // onError를 useEffect로 이동 (render 중 setState 방지)
  useEffect(() => {
    if (error) onError?.();
  }, [error, onError]);

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-6 rounded-lg bg-red-500/10 border border-red-500/20">
        <span className="text-sm text-red-400">{error}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/30 border border-white/[0.08]">
        <div ref={containerRef} className="absolute inset-0 [&>div]:w-full [&>div]:h-full [&>iframe]:w-full [&>iframe]:h-full" />
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white/20 border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        )}
      </div>
      {isReady && (
        <button
          type="button"
          onClick={replay}
          className="self-center px-4 py-1.5 text-xs text-[var(--text-secondary)] bg-white/[0.05] hover:bg-white/[0.08] rounded-lg transition-colors"
        >
          다시 보기
        </button>
      )}
    </div>
  );
}
