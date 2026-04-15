'use client';

import { useBreathingStore } from '@/stores/breathingStore';
import type { BreathMode } from '@/types';

interface ModeOption {
  mode: BreathMode;
  title: string;
  icon: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  difficultyLabel: string;
  time: string;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    mode: 'long',
    title: '롱 브레스',
    icon: 'LB',
    description: '한 호흡을 최대한 길게 유지하여 폐활량과 호흡 지구력을 키웁니다.',
    difficulty: 'easy',
    difficultyLabel: '초급',
    time: '1~3분',
  },
  {
    mode: 'rhythm',
    title: '리듬 브레스',
    icon: 'RB',
    description: '들숨-유지-날숨 패턴을 따라 호흡의 안정성과 제어력을 훈련합니다.',
    difficulty: 'medium',
    difficultyLabel: '중급',
    time: '3~5분',
  },
  {
    mode: 'phrase',
    title: '프레이즈 호흡',
    icon: 'PB',
    description: '목표 시간 동안 호흡을 유지하며 실전 프레이즈 길이에 맞춰 연습합니다.',
    difficulty: 'hard',
    difficultyLabel: '고급',
    time: '2~5분',
  },
];

const DIFFICULTY_BADGE: Record<string, string> = {
  easy: 'bg-green-500/[0.12] text-[var(--success)]',
  medium: 'bg-yellow-500/[0.12] text-[var(--warning)]',
  hard: 'bg-red-500/[0.12] text-[var(--error)]',
};

export default function ModeSelector() {
  const mode = useBreathingStore((s) => s.mode);
  const isActive = useBreathingStore((s) => s.isActive);
  const setMode = useBreathingStore((s) => s.setMode);

  const handleSelect = (m: BreathMode) => {
    if (isActive) return;
    setMode(m);
  };

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-[var(--text)] mb-1">훈련 모드</h2>
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        {MODE_OPTIONS.map((opt) => {
          const isSelected = mode === opt.mode;
          return (
            <button
              key={opt.mode}
              type="button"
              className={`flex flex-col gap-2.5 p-5 border rounded-lg cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'bg-blue-500/10 border-blue-500/40 hover:bg-blue-500/[0.14] hover:border-blue-500/50'
                  : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface2)] hover:border-[var(--border2)] hover:-translate-y-0.5'
              }`}
              onClick={() => handleSelect(opt.mode)}
              disabled={isActive}
              aria-pressed={isSelected}
            >
              <div
                className={`w-10 h-10 flex items-center justify-center rounded-md text-sm font-bold tracking-wide ${
                  isSelected
                    ? 'bg-blue-500/20 text-[var(--accent)]'
                    : 'bg-[var(--surface2)] text-[var(--text2)]'
                }`}
              >
                {opt.icon}
              </div>
              <div className="text-base font-semibold text-[var(--text)]">{opt.title}</div>
              <div className="text-sm text-[var(--text2)] leading-relaxed">{opt.description}</div>
              <div className="flex items-center gap-3 mt-auto">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${DIFFICULTY_BADGE[opt.difficulty]}`}
                >
                  {opt.difficultyLabel}
                </span>
                <span className="text-xs text-[var(--muted)]">{opt.time}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
