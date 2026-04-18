'use client';

import type { BeatGrid } from '@/types';

interface RhythmMarkerProps {
  beatGrid: BeatGrid | null;
  currentTimeSec: number;
  windowSec?: number; // 표시 시간 범위 (기본 ±2초)
  heightPx?: number;
}

/**
 * 곡 재생 중 정박 위치를 보여주는 수평 타임라인 오버레이.
 * 현재 시각을 중심으로 전후 windowSec 이내의 비트만 렌더 (60fps 최적화).
 */
export default function RhythmMarker({
  beatGrid,
  currentTimeSec,
  windowSec = 2,
  heightPx = 36,
}: RhythmMarkerProps) {
  if (!beatGrid || beatGrid.beatTimes.length === 0) return null;

  const visibleBeats = beatGrid.beatTimes.filter(
    (t) => Math.abs(t - currentTimeSec) <= windowSec
  );

  return (
    <div
      className="relative w-full bg-[var(--surface)] border-y border-[var(--border)] overflow-hidden"
      style={{ height: heightPx }}
      role="presentation"
    >
      {/* 중앙 현재 시각 라인 */}
      <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />

      {/* 비트 마커 */}
      {visibleBeats.map((t, idx) => {
        const offsetRatio = (t - currentTimeSec) / windowSec; // -1 ~ +1
        const leftPct = 50 + offsetRatio * 50;
        const isPast = t < currentTimeSec;
        return (
          <div
            key={`${t}-${idx}`}
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-6 rounded-full transition-opacity ${
              isPast ? 'bg-[var(--muted)] opacity-50' : 'bg-[var(--text2)]'
            }`}
            style={{ left: `${leftPct}%`, willChange: 'transform' }}
          />
        );
      })}

      {/* BPM 라벨 */}
      <div className="absolute top-1 left-2 text-[10px] text-[var(--muted)] font-[Inter,monospace]">
        {Math.round(beatGrid.bpm)} BPM
      </div>
    </div>
  );
}
