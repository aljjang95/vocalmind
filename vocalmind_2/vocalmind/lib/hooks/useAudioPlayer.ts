'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface LoopRange {
  start: number;
  end: number;
}

interface AudioPlayerState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
}

interface AudioPlayerActions {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (time: number) => void;
  setLoopRange: (start: number, end: number) => void;
  clearLoopRange: () => void;
}

export type AudioPlayer = AudioPlayerState & AudioPlayerActions;

export function useAudioPlayer(url: string | null): AudioPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loopRef = useRef<LoopRange | null>(null);
  const rafRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 시간 업데이트 루프
  const updateTime = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(audio.currentTime);

    // 구간 반복 체크
    const loop = loopRef.current;
    if (loop && audio.currentTime >= loop.end) {
      audio.currentTime = loop.start;
    }

    if (!audio.paused) {
      rafRef.current = requestAnimationFrame(updateTime);
    }
  }, []);

  // URL 변경 시 오디오 초기화
  useEffect(() => {
    if (!url) {
      audioRef.current = null;
      setIsPlaying(false);
      setIsLoading(false);
      setCurrentTime(0);
      setDuration(0);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    let cancelled = false;

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      if (cancelled) return;
      setDuration(audio.duration);
      setIsLoading(false);
    });

    audio.addEventListener('ended', () => {
      if (cancelled) return;
      const loop = loopRef.current;
      if (loop) {
        audio.currentTime = loop.start;
        audio.play();
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    });

    audio.addEventListener('error', () => {
      if (cancelled) return;
      setError('음성을 불러올 수 없습니다');
      setIsLoading(false);
      setIsPlaying(false);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
      setIsPlaying(false);
    };
  }, [url]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => {
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(updateTime);
    }).catch(() => {
      setError('재생할 수 없습니다');
    });
  }, [updateTime]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
    cancelAnimationFrame(rafRef.current);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setLoopRange = useCallback((start: number, end: number) => {
    loopRef.current = { start, end };
  }, []);

  const clearLoopRange = useCallback(() => {
    loopRef.current = null;
  }, []);

  return {
    isPlaying, isLoading, currentTime, duration, error,
    play, pause, toggle, seek, setLoopRange, clearLoopRange,
  };
}
