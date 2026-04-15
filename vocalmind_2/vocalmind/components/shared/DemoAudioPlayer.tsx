'use client';

import { useState, useEffect } from 'react';
import { useAudioPlayer } from '@/lib/hooks/useAudioPlayer';

interface DemoAudioPlayerProps {
  url: string;
  label?: string;
  onError?: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function DemoAudioPlayer({ url, label, onError }: DemoAudioPlayerProps) {
  const player = useAudioPlayer(url);
  const [loopActive, setLoopActive] = useState(false);
  const [loopStart, setLoopStart] = useState(0);

  useEffect(() => {
    if (player.error) onError?.();
  }, [player.error, onError]);

  if (player.error) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
        <span className="text-sm text-red-400">{player.error}</span>
      </div>
    );
  }

  if (player.isLoading) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
        <div className="w-5 h-5 border-2 border-[var(--bg-surface)] border-t-[var(--accent)] rounded-full animate-spin" />
        <span className="text-sm text-[var(--text-muted)]">음성 로딩 중...</span>
      </div>
    );
  }

  const progress = player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0;

  const handleLoopToggle = () => {
    if (loopActive) {
      player.clearLoopRange();
      setLoopActive(false);
    } else {
      const start = player.currentTime;
      const end = Math.min(start + 10, player.duration);
      setLoopStart(start);
      player.setLoopRange(start, end);
      setLoopActive(true);
    }
  };

  return (
    <div className="flex flex-col gap-2 px-4 py-3 rounded-lg bg-white/[0.03] border border-white/[0.08]">
      {label && (
        <span className="text-xs text-[var(--text-muted)] font-medium">{label}</span>
      )}

      <div className="flex items-center gap-3">
        {/* 재생/일시정지 버튼 */}
        <button
          type="button"
          onClick={player.toggle}
          className="w-10 h-10 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0 hover:bg-[var(--accent-hover)] transition-colors"
          aria-label={player.isPlaying ? '일시정지' : '재생'}
        >
          {player.isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="1" width="3.5" height="12" rx="1" />
              <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M3 1.5v11l9.5-5.5z" />
            </svg>
          )}
        </button>

        {/* 진행바 */}
        <div className="flex-1 flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={player.duration || 1}
            step={0.1}
            value={player.currentTime}
            onChange={(e) => player.seek(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-white/10 cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--accent)]"
            style={{
              background: `linear-gradient(to right, var(--accent) ${progress}%, rgba(255,255,255,0.1) ${progress}%)`,
            }}
          />
          <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
            <span>{formatTime(player.currentTime)}</span>
            <span>{formatTime(player.duration)}</span>
          </div>
        </div>

        {/* 구간 반복 버튼 */}
        <button
          type="button"
          onClick={handleLoopToggle}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
            loopActive
              ? 'bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30'
              : 'bg-white/[0.05] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
          title={loopActive ? `${formatTime(loopStart)}~ 구간 반복 해제` : '현재 위치부터 10초 구간 반복'}
          aria-label="구간 반복"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 2l4 4-4 4" />
            <path d="M3 11V9a4 4 0 014-4h14" />
            <path d="M7 22l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 01-4 4H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
