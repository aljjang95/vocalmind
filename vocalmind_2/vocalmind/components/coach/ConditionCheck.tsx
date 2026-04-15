'use client';

import { useState, useCallback } from 'react';
import { useCoachStore } from '@/stores/coachStore';
import type { CoachCondition } from '@/types';

const CONDITIONS: {
  value: CoachCondition;
  label: string;
  desc: string;
  icon: string;
  activeClasses: string;
  iconColor: string;
}[] = [
  {
    value: 'good',
    label: '좋음',
    desc: '목 상태가 좋고 에너지 충분',
    icon: '[+]',
    activeClasses: 'border-[var(--success)] bg-[rgba(34,197,94,0.1)]',
    iconColor: 'text-[var(--success)]',
  },
  {
    value: 'normal',
    label: '보통',
    desc: '평소와 비슷한 컨디션',
    icon: '[=]',
    activeClasses: 'border-[var(--accent)] bg-[rgba(59,130,246,0.1)]',
    iconColor: 'text-[var(--accent-lt)]',
  },
  {
    value: 'tired',
    label: '피곤',
    desc: '체력이 좀 떨어진 상태',
    icon: '[-]',
    activeClasses: 'border-[var(--warning)] bg-[rgba(234,179,8,0.1)]',
    iconColor: 'text-[var(--warning)]',
  },
  {
    value: 'bad',
    label: '안 좋음',
    desc: '목이 아프거나 컨디션 저하',
    icon: '[!]',
    activeClasses: 'border-[var(--error)] bg-[rgba(239,68,68,0.1)]',
    iconColor: 'text-[var(--error)]',
  },
];

export default function ConditionCheck() {
  const { setCondition, setPhase, getNextStageId } = useCoachStore();
  const [selected, setSelected] = useState<CoachCondition | null>(null);

  const handleSelect = useCallback((value: CoachCondition) => {
    setSelected(value);
  }, []);

  const handleStart = useCallback(() => {
    if (!selected) return;
    setCondition(selected);

    const nextStageId = getNextStageId();
    const store = useCoachStore.getState();
    store.startLesson(nextStageId, 80);
    setPhase('lesson');
  }, [selected, setCondition, setPhase, getNextStageId]);

  return (
    <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r)] p-8 max-[768px]:p-5 max-w-[600px] mx-auto animate-[slideIn_0.4s_ease-out]">
      <h2 className="text-[var(--fs-h2)] font-bold text-[var(--text)] text-center mb-2">오늘 컨디션은?</h2>
      <p className="text-[var(--fs-sm)] text-[var(--text2)] text-center mb-7">컨디션에 따라 레슨 난이도가 조정됩니다.</p>

      <div className="grid grid-cols-2 gap-3 max-[768px]:gap-2.5 mb-6">
        {CONDITIONS.map((cond) => {
          const isActive = selected === cond.value;
          return (
            <button
              key={cond.value}
              type="button"
              className={`flex flex-col items-center gap-2 px-4 py-5 max-[768px]:px-3 max-[768px]:py-4 rounded-[var(--r-sm)] border-2 cursor-pointer transition-all duration-200 text-center ${
                isActive
                  ? cond.activeClasses
                  : 'border-[var(--border2)] bg-[var(--surface)] hover:bg-[var(--surface2)]'
              }`}
              onClick={() => handleSelect(cond.value)}
            >
              <div className={`text-2xl font-extrabold leading-none ${isActive ? cond.iconColor : ''}`}>
                {cond.icon}
              </div>
              <div className="text-[var(--fs-body)] font-bold text-[var(--text)]">{cond.label}</div>
              <div className="text-[var(--fs-xs)] text-[var(--muted)] leading-snug">{cond.desc}</div>
            </button>
          );
        })}
      </div>

      {selected === 'bad' && (
        <div className="flex items-start gap-2.5 px-4 py-3 bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-[var(--r-xs)] mb-6">
          <span className="shrink-0 text-[var(--error)] text-base leading-snug">&#9888;</span>
          <span className="text-[var(--fs-xs)] text-[var(--text2)] leading-normal">
            무리하지 마세요. 가볍게 복습만 합니다.
            성대에 무리가 가지 않는 범위에서 짧게 연습합니다.
          </span>
        </div>
      )}

      <button
        type="button"
        className="block w-full px-6 py-3.5 border-none rounded-[var(--r-xs)] bg-[var(--cta-bg)] text-[var(--cta-text)] text-[var(--fs-body)] font-bold cursor-pointer transition-colors duration-200 hover:enabled:bg-[var(--cta-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleStart}
        disabled={!selected}
      >
        레슨 시작
      </button>
    </div>
  );
}
