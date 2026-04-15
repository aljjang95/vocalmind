'use client';

import { useState, useEffect, useRef } from 'react';
import { extractMelody } from '@/lib/audio/melodyExtractor';
import type { MelodyPoint } from '@/types';

interface UseDemoPitchReturn {
  referencePitches: MelodyPoint[];
  isLoading: boolean;
  error: string | null;
  duration: number;
}

// 모듈 레벨 캐시 (LRU 20개, useTTS 패턴)
const cache = new Map<string, { pitches: MelodyPoint[]; duration: number }>();
const MAX_CACHE = 20;

function setCache(url: string, data: { pitches: MelodyPoint[]; duration: number }) {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value!;
    cache.delete(oldest);
  }
  cache.set(url, data);
}

export function useDemoPitch(demoAudioUrl: string | undefined): UseDemoPitchReturn {
  const [referencePitches, setReferencePitches] = useState<MelodyPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const urlRef = useRef(demoAudioUrl);

  useEffect(() => {
    urlRef.current = demoAudioUrl;
    if (!demoAudioUrl) {
      setReferencePitches([]);
      setDuration(0);
      setError(null);
      return;
    }

    // 캐시 히트
    const cached = cache.get(demoAudioUrl);
    if (cached) {
      setReferencePitches(cached.pitches);
      setDuration(cached.duration);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(demoAudioUrl);
        if (!res.ok) throw new Error('오디오를 불러올 수 없습니다');
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;

        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        await audioCtx.close();
        if (cancelled) return;

        const pitches = await extractMelody(audioBuffer);
        if (cancelled) return;

        const dur = audioBuffer.duration;
        setCache(demoAudioUrl, { pitches, duration: dur });
        setReferencePitches(pitches);
        setDuration(dur);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '피치 추출 실패');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [demoAudioUrl]);

  return { referencePitches, isLoading, error, duration };
}
