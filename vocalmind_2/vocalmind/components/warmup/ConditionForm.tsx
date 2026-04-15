'use client';

import { useState, useCallback } from 'react';
import { useWarmupStore } from '@/stores/warmupStore';
import { WarmupCondition, WarmupRoutine, VoiceType } from '@/types';
import { GlowCard } from '@/components/ui/glow-card';

const ENERGY_OPTIONS: { value: WarmupCondition['energy']; label: string }[] = [
  { value: 'good', label: '좋음' },
  { value: 'normal', label: '보통' },
  { value: 'tired', label: '피곤함' },
  { value: 'bad', label: '안 좋음' },
];

const GOAL_OPTIONS = [
  '고음 확장',
  '음정 안정',
  '호흡 강화',
  '음색 개선',
  '테크닉 연습',
  '가볍게 풀기',
] as const;

const VOICE_OPTIONS: { value: VoiceType; label: string }[] = [
  { value: '저음', label: '저음' },
  { value: '중음', label: '중음' },
  { value: '고음', label: '고음' },
];

interface ConditionFormProps {
  onRoutineGenerated: (routine: WarmupRoutine) => void;
}

export default function ConditionForm({ onRoutineGenerated }: ConditionFormProps) {
  const { isGenerating, error, setGenerating, setError, setCondition, setRoutine } = useWarmupStore();

  const [energy, setEnergy] = useState<WarmupCondition['energy'] | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [voiceType, setVoiceType] = useState<VoiceType>('중음');

  const toggleGoal = useCallback((goal: string) => {
    setGoals((prev) => {
      if (prev.includes(goal)) {
        return prev.filter((g) => g !== goal);
      }
      if (prev.length >= 2) return prev;
      return [...prev, goal];
    });
  }, []);

  const canSubmit = energy !== null && goals.length >= 1 && !isGenerating;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !energy) return;

    const condition: WarmupCondition = { energy, goals };
    setCondition(condition);
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/warmup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ condition, voiceType }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        if (res.status === 429) {
          throw new Error('요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.');
        }
        throw new Error(errBody.error ?? `서버 오류가 발생했습니다. (${res.status})`);
      }

      const routine = await res.json() as WarmupRoutine;
      setRoutine(routine);
      onRoutineGenerated(routine);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '루틴 생성에 실패했습니다.';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }, [canSubmit, energy, goals, voiceType, setCondition, setGenerating, setError, setRoutine, onRoutineGenerated]);

  return (
    <GlowCard className="max-w-[600px] mx-auto p-8 animate-[slideIn_0.4s_ease-out] max-sm:p-5">
      <h2 className="text-2xl font-bold text-[var(--text)] mb-2">오늘의 워밍업</h2>
      <p className="text-sm text-[var(--text2)] mb-7">현재 컨디션에 맞는 AI 맞춤 워밍업 루틴을 생성합니다.</p>

      {/* 에너지 수준 */}
      <div className="mb-6">
        <div className="text-sm font-semibold text-[var(--text)] mb-3">오늘 컨디션은 어떤가요?</div>
        <div className="flex flex-wrap gap-2.5 max-sm:gap-2">
          {ENERGY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`px-[18px] py-2.5 rounded-md border text-sm cursor-pointer transition-all select-none max-sm:px-3.5 max-sm:py-2 max-sm:text-xs ${
                energy === opt.value
                  ? 'bg-blue-500/[0.15] border-[var(--accent)] text-[var(--accent-lt)]'
                  : 'bg-[var(--surface)] border-[var(--border2)] text-[var(--text2)] hover:bg-[var(--surface2)] hover:border-[var(--accent)] hover:text-[var(--text)]'
              }`}
              onClick={() => setEnergy(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {energy === 'bad' && (
          <div className="flex items-start gap-2.5 p-3 px-4 bg-yellow-500/[0.08] border border-yellow-500/20 rounded-md mt-4">
            <span className="shrink-0 text-[var(--warning)] text-base leading-[1.4]">&#9888;</span>
            <span className="text-xs text-[var(--text2)] leading-relaxed">
              컨디션이 좋지 않을 때는 성대에 무리가 가지 않는 가벼운 연습만 추천됩니다.
              무리하지 말고 컨디션이 회복된 후 본격적인 연습을 진행하세요.
            </span>
          </div>
        )}
      </div>

      {/* 목표 선택 */}
      <div className="mb-6">
        <div className="text-sm font-semibold text-[var(--text)] mb-3">
          오늘의 목표
          <span className="text-xs text-[var(--muted)] font-normal ml-1.5">(최대 2개 선택)</span>
        </div>
        <div className="flex flex-wrap gap-2.5 max-sm:gap-2">
          {GOAL_OPTIONS.map((goal) => {
            const isActive = goals.includes(goal);
            const isDisabled = !isActive && goals.length >= 2;
            return (
              <button
                key={goal}
                type="button"
                className={`px-4 py-2.5 rounded-md border text-sm cursor-pointer transition-all select-none max-sm:px-3.5 max-sm:py-2 max-sm:text-xs ${
                  isActive
                    ? 'bg-purple-500/[0.15] border-[var(--accent2)] text-[var(--accent2-lt)]'
                    : isDisabled
                      ? 'bg-[var(--surface)] border-[var(--border2)] text-[var(--text2)] opacity-40 cursor-not-allowed'
                      : 'bg-[var(--surface)] border-[var(--border2)] text-[var(--text2)] hover:bg-[var(--surface2)] hover:border-[var(--accent2)] hover:text-[var(--text)]'
                }`}
                onClick={() => !isDisabled && toggleGoal(goal)}
                disabled={isDisabled}
              >
                {goal}
              </button>
            );
          })}
        </div>
      </div>

      {/* 보이스 타입 */}
      <div className="mb-6">
        <div className="text-sm font-semibold text-[var(--text)] mb-3">보이스 타입</div>
        <div className="flex gap-2.5">
          {VOICE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`px-5 py-2.5 rounded-md border text-sm cursor-pointer transition-all select-none max-sm:px-3.5 max-sm:py-2 max-sm:text-xs ${
                voiceType === opt.value
                  ? 'bg-green-500/[0.12] border-[var(--success)] text-[var(--success-lt)]'
                  : 'bg-[var(--surface)] border-[var(--border2)] text-[var(--text2)] hover:bg-[var(--surface2)] hover:border-[var(--success)] hover:text-[var(--text)]'
              }`}
              onClick={() => setVoiceType(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mt-3 px-3.5 py-2.5 bg-red-500/[0.08] border border-red-500/20 rounded-md text-xs text-[var(--error-lt)]">
          {error}
        </div>
      )}

      {/* 생성 버튼 */}
      <button
        type="button"
        className="flex items-center justify-center gap-2 w-full px-6 py-3.5 mt-7 rounded-md border-none bg-[var(--cta-bg)] text-[var(--cta-text)] text-base font-bold cursor-pointer transition-colors hover:bg-[var(--cta-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        {isGenerating ? (
          <>
            루틴 생성 중
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--cta-text)] animate-[dotBounce_1.4s_infinite_ease-in-out]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--cta-text)] animate-[dotBounce_1.4s_infinite_ease-in-out_0.16s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--cta-text)] animate-[dotBounce_1.4s_infinite_ease-in-out_0.32s]" />
            </span>
          </>
        ) : (
          '루틴 생성'
        )}
      </button>
    </GlowCard>
  );
}
