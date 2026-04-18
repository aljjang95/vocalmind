'use client';

import { useEffect, useState } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import type { RhythmClassification } from '@/types';

const COLORS: Record<RhythmClassification, { bg: string; text: string; label: string }> = {
  perfect: { bg: 'bg-[var(--success)]',     text: 'text-white', label: '정박' },
  good:    { bg: 'bg-[var(--warning)]',     text: 'text-black', label: '근접' },
  off:     { bg: 'bg-[var(--error-lt)]',    text: 'text-white', label: '빗나감' },
  miss:    { bg: 'bg-[var(--error)]',       text: 'text-white', label: '놓침' },
  ghost:   { bg: 'bg-[var(--muted)]',       text: 'text-white', label: '여분' },
};

/**
 * 실시간 리듬 분류 시각 피드백 — 최근 분류를 색상 배지로 표시.
 * 0.6초 후 페이드 아웃, 다음 분류가 오면 즉시 교체.
 */
export default function RhythmLiveIndicator() {
  const { rhythmEnabled, rhythmLive } = usePracticeStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!rhythmLive) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 600);
    return () => clearTimeout(t);
  }, [rhythmLive]);

  if (!rhythmEnabled || !rhythmLive || !rhythmLive.lastClassification) return null;

  const color = COLORS[rhythmLive.lastClassification];

  return (
    <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-40">
      <div
        className={`${color.bg} ${color.text} px-4 py-1.5 rounded-full text-xs font-bold shadow-lg transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {color.label}
      </div>
    </div>
  );
}
