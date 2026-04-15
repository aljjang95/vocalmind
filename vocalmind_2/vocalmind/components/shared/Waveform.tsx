'use client';

import { useRef } from 'react';

interface WaveformProps {
  count?: number;
  animated?: boolean;
  className?: string;
}

interface BarData {
  minH: number;
  maxH: number;
  dur: number;
  delay: number;
}

// Fixed heights for Feature mini waveform
const FEAT_HEIGHTS = [20, 35, 50, 40, 60, 55, 70, 65, 80, 75, 68, 90, 85, 72, 60, 78, 65, 50, 40, 55, 70];

export default function Waveform({ count = 40, animated = true, className }: WaveformProps) {
  // 랜덤값은 마운트 시 1회만 생성 — SSR hydration 불일치 방지
  const barsRef = useRef<BarData[] | null>(null);
  if (!barsRef.current) {
    barsRef.current = Array.from({ length: count }, () => ({
      minH: Math.random() * 8 + 4,
      maxH: Math.random() * 30 + 10,
      dur: parseFloat((Math.random() * 0.9 + 0.4).toFixed(2)),
      delay: parseFloat((Math.random() * 0.8).toFixed(2)),
    }));
  }

  return (
    <div className={`h-[60px] flex items-center gap-[3px] justify-center bg-black/20 rounded-xl px-4 overflow-hidden relative mb-[18px] before:content-[''] before:absolute before:top-0 before:bottom-0 before:left-0 before:w-10 before:z-[1] before:pointer-events-none before:bg-gradient-to-r before:from-[rgba(24,24,27,0.95)] before:to-transparent after:content-[''] after:absolute after:top-0 after:bottom-0 after:right-0 after:w-10 after:z-[1] after:pointer-events-none after:bg-gradient-to-l after:from-[rgba(24,24,27,0.95)] after:to-transparent ${className ?? ''}`}>
      {barsRef.current.map((bar, i) => (
        <div
          key={i}
          className="w-[3.5px] rounded-[3px] shrink-0 bg-gradient-to-t from-[var(--accent)] to-[var(--success-lt)]"
          style={{
            ['--min-h' as string]: `${bar.minH}px`,
            ['--max-h' as string]: `${bar.maxH}px`,
            animation: `waveAnim ${bar.dur}s ease-in-out infinite alternate`,
            animationDelay: animated ? `${bar.delay}s` : '0s',
            animationPlayState: animated ? 'running' : 'paused',
          }}
        />
      ))}
    </div>
  );
}

export function FeatMiniWaveform() {
  return (
    <div className="flex items-end gap-[3px] h-[50px] mb-3">
      {FEAT_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-[3px] bg-gradient-to-t from-[var(--accent)] to-[var(--success-lt)] animate-[fmbAnim_1.5s_ease-in-out_infinite_alternate]"
          style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }}
        />
      ))}
    </div>
  );
}
