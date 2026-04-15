'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTTSReturn {
  play: () => void;
  stop: () => void;
  isPlaying: boolean;
  isLoading: boolean;
}

/** Module-level cache: text -> audio blob URL (LRU, max 20) */
const MAX_CACHE = 20;
const audioCache = new Map<string, string>();

function cacheSet(key: string, url: string) {
  if (audioCache.size >= MAX_CACHE) {
    const oldest = audioCache.keys().next().value!;
    URL.revokeObjectURL(audioCache.get(oldest)!);
    audioCache.delete(oldest);
  }
  audioCache.set(key, url);
}

export function useTTS(text: string): UseTTSReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  const play = useCallback(async () => {
    if (isLoading || isPlaying) {
      stop();
      return;
    }

    const cached = audioCache.get(text);
    if (cached) {
      const audio = new Audio(cached);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      setIsPlaying(true);
      audio.play().catch(() => setIsPlaying(false));
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!res.ok) {
        setIsLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      cacheSet(text, url);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      setIsLoading(false);
      setIsPlaying(true);
      audio.play().catch(() => setIsPlaying(false));
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setIsLoading(false);
    }
  }, [text, isLoading, isPlaying, stop]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  return { play, stop, isPlaying, isLoading };
}
