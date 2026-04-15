'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import styles from './AudioPlayer.module.css';

// 전역 재생 중인 오디오 추적 (동시 재생 방지)
let currentlyPlaying: HTMLAudioElement | null = null;

interface AudioPlayerProps {
  src: string;
  onPlay?: () => void;
  /** 값이 바뀔 때마다 재생을 트리거합니다 (syncPlay 용도) */
  playTrigger?: number;
}

export default function AudioPlayer({ src, onPlay, playTrigger }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
        setProgress(audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      audio.currentTime = 0;
      if (currentlyPlaying === audio) {
        currentlyPlaying = null;
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      if (currentlyPlaying === audio) currentlyPlaying = null;
    };
  }, [src, isDragging]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      if (currentlyPlaying === audio) currentlyPlaying = null;
    } else {
      // 다른 플레이어 정지
      if (currentlyPlaying && currentlyPlaying !== audio) {
        currentlyPlaying.pause();
        // 이벤트는 각 플레이어가 자체 처리
      }
      audio.play().then(() => {
        currentlyPlaying = audio;
        setIsPlaying(true);
        onPlay?.();
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  }, [isPlaying, onPlay]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio * 100);
    setCurrentTime(audio.currentTime);
  }, []);

  const handleMouseDown = useCallback(() => setIsDragging(true), []);
  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const formatTime = (sec: number): string => {
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // 다른 오디오가 재생 시작되면 이 플레이어 상태 동기화
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePause = () => {
      if (currentlyPlaying !== audio) {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('pause', handlePause);
    return () => audio.removeEventListener('pause', handlePause);
  }, []);

  // 외부에서 playTrigger가 변경되면 재생 시작 (syncPlay 용도)
  useEffect(() => {
    if (playTrigger === undefined || playTrigger === 0) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (currentlyPlaying && currentlyPlaying !== audio) {
      currentlyPlaying.pause();
    }
    audio.currentTime = 0;
    audio.play().then(() => {
      currentlyPlaying = audio;
      setIsPlaying(true);
      onPlay?.();
    }).catch(() => {
      setIsPlaying(false);
    });
  // playTrigger 변화에만 반응
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playTrigger]);

  return (
    <div className={styles.player}>
      <button
        type="button"
        className={styles.playBtn}
        onClick={togglePlay}
        aria-label={isPlaying ? '일시정지' : '재생'}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="2" width="3.5" height="10" rx="1"/>
            <rect x="8.5" y="2" width="3.5" height="10" rx="1"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M3 2.5l9 4.5-9 4.5V2.5z"/>
          </svg>
        )}
      </button>

      <div
        ref={progressBarRef}
        className={styles.progressBar}
        onClick={handleProgressClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        role="slider"
        aria-label="재생 위치"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <span className={styles.timeDisplay}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}
