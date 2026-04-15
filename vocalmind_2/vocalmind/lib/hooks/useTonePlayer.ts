'use client';

import { useCallback, useRef, useState } from 'react';
import { useScalePracticeStore } from '@/stores/scalePracticeStore';
import { Note } from 'tonal';

interface UseTonePlayerOptions {
  onScaleSetComplete?: (transposeIndex: number) => void;
}

interface UseTonePlayerReturn {
  start: () => Promise<void>;
  stop: () => void;
  isReady: boolean;
  duckVolume: () => void;
  restoreVolume: () => void;
}

/**
 * 스케일 자동 연주 스케줄러.
 * 소리 재생은 PianoKeyboard의 soundfont-player가 담당.
 * 이 훅은 어떤 음을 언제 칠지(store.setCurrentNote) 스케줄링만 담당.
 */
export function useTonePlayer(options?: UseTonePlayerOptions): UseTonePlayerReturn {
  const [isReady] = useState(true);
  const stopRef = useRef(false);
  const store = useScalePracticeStore;

  const start = useCallback(async () => {
    const { pattern, startNote, bpm, transposeRange } = store.getState();
    store.getState().setIsPlaying(true);
    stopRef.current = false;

    const baseMidi = Note.midi(startNote) ?? 48;
    const [minT, maxT] = transposeRange;
    const beatDuration = 60 / bpm;

    for (let t = minT; t <= maxT; t++) {
      if (stopRef.current) break;
      store.getState().setCurrentTranspose(t);
      const rootMidi = baseMidi + t;

      for (let i = 0; i < pattern.length; i++) {
        if (stopRef.current) break;
        const interval = pattern[i];

        if (interval < 0) {
          store.getState().setCurrentNote(null);
          await new Promise((r) => setTimeout(r, beatDuration * 1000));
          continue;
        }

        const midi = rootMidi + interval;
        store.getState().setCurrentNote(midi);
        await new Promise((r) => setTimeout(r, beatDuration * 1000));
      }

      if (stopRef.current) break;

      // 스케일 1세트 완료 → 쉬는 구간
      store.getState().setCurrentNote(null);
      options?.onScaleSetComplete?.(t - minT);
      await new Promise((r) => setTimeout(r, 2000));
    }

    store.getState().setIsPlaying(false);
    store.getState().setCurrentNote(null);
  }, [options, store]);

  const stop = useCallback(() => {
    stopRef.current = true;
    store.getState().setIsPlaying(false);
    store.getState().setCurrentNote(null);
  }, [store]);

  const duckVolume = useCallback(() => {}, []);
  const restoreVolume = useCallback(() => {}, []);

  return { start, stop, isReady, duckVolume, restoreVolume };
}
