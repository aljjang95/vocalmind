'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

// YouTube IFrame API 최소 타입 (UMD 글로벌 참조 회피)
interface YTPlayer {
  destroy(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
}

interface YTPlayerConstructorOptions {
  videoId: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: () => void;
    onStateChange?: (e: { data: number }) => void;
    onError?: () => void;
  };
}

interface YTNamespace {
  Player: new (el: HTMLElement, opts: YTPlayerConstructorOptions) => YTPlayer;
  PlayerState: { PLAYING: number };
}

declare global {
  interface Window {
    YT: YTNamespace;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface UseYouTubePlayerReturn {
  containerRef: React.RefObject<HTMLDivElement>;
  isReady: boolean;
  isPlaying: boolean;
  replay: () => void;
  error: string | null;
}

let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise;
  if (typeof window !== 'undefined' && window.YT?.Player) {
    return Promise.resolve();
  }

  apiLoadPromise = new Promise<void>((resolve, reject) => {
    if (document.getElementById('youtube-iframe-api')) {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
      return;
    }

    const script = document.createElement('script');
    script.id = 'youtube-iframe-api';
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => reject(new Error('YouTube API 로드 실패'));
    window.onYouTubeIframeAPIReady = () => resolve();
    document.head.appendChild(script);
  });

  return apiLoadPromise;
}

export function useYouTubePlayer(
  videoId: string | undefined,
  startSec?: number,
  endSec?: number,
): UseYouTubePlayerReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const rafRef = useRef<number>(0);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId || typeof window === 'undefined') return;

    let destroyed = false;

    (async () => {
      try {
        await loadYouTubeAPI();
        if (destroyed || !containerRef.current) return;

        const container = containerRef.current;
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
        const targetDiv = document.createElement('div');
        container.appendChild(targetDiv);

        const player = new window.YT.Player(targetDiv, {
          videoId,
          playerVars: {
            start: startSec ?? 0,
            autoplay: 0,
            modestbranding: 1,
            rel: 0,
            fs: 1,
          },
          events: {
            onReady: () => {
              if (destroyed) return;
              playerRef.current = player;
              setIsReady(true);
            },
            onStateChange: (e: { data: number }) => {
              if (destroyed) return;
              setIsPlaying(e.data === window.YT.PlayerState.PLAYING);
            },
            onError: () => {
              if (destroyed) return;
              setError('영상을 불러올 수 없습니다');
            },
          },
        });
      } catch {
        if (!destroyed) setError('YouTube API 로드 실패');
      }
    })();

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
    };
  }, [videoId, startSec]);

  // 구간 끝 감지
  useEffect(() => {
    if (!isPlaying || endSec == null) return;

    const checkEnd = () => {
      const player = playerRef.current;
      if (player && player.getCurrentTime() >= endSec) {
        player.pauseVideo();
        return;
      }
      rafRef.current = requestAnimationFrame(checkEnd);
    };
    rafRef.current = requestAnimationFrame(checkEnd);

    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, endSec]);

  const replay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(startSec ?? 0, true);
    player.playVideo();
  }, [startSec]);

  return { containerRef, isReady, isPlaying, replay, error };
}
