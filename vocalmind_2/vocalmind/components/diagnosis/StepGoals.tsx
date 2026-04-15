'use client';

import { useDiagnosisStore } from '@/stores/diagnosisStore';

const GOAL_SUGGESTIONS = [
  '노래방에서 고음을 자신 있게 부르고 싶어요',
  '오디션을 준비하고 있어요',
  '밴드 보컬로 활동하고 싶어요',
  '취미로 노래 실력을 키우고 싶어요',
  '유튜브/커버 영상을 올리고 싶어요',
  '성악 기초를 다지고 싶어요',
];

export default function StepGoals() {
  const { goal, setGoal, setStep } = useDiagnosisStore();

  const canProceed = goal.trim().length >= 1;

  return (
    <div className="animate-[slideIn_0.4s_ease-out]">
      <h2 className="text-[1.6rem] max-md:text-[1.3rem] font-bold mb-2">어떤 목표를 가지고 있나요?</h2>
      <p className="text-[0.9rem] text-[var(--text2)] mb-7 leading-relaxed">직접 입력하거나, 아래에서 골라보세요.</p>

      <div className="mb-[22px] relative">
        <textarea
          className="w-full py-3 px-4 bg-[var(--surface2)] border border-[var(--border)] rounded-[var(--r-xs)] text-[var(--text)] text-[0.9rem] outline-none resize-y min-h-[80px] transition-colors duration-200 focus:border-blue-500/50 placeholder:text-[var(--muted)]"
          placeholder="목표를 자유롭게 적어주세요 (최대 200자)"
          value={goal}
          onChange={(e) => setGoal(e.target.value.slice(0, 200))}
          maxLength={200}
          rows={3}
        />
        <span className="absolute bottom-2 right-3 text-[0.68rem] text-[var(--muted)] font-mono">{goal.length}/200</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {GOAL_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className={`px-4 py-2 border rounded-[20px] text-[0.78rem] cursor-pointer transition-all duration-200 ${
              goal === s
                ? 'border-[var(--accent)] bg-blue-500/10 text-[var(--accent-lt)]'
                : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text2)] hover:border-[var(--border2)] hover:text-[var(--text)]'
            }`}
            onClick={() => setGoal(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex justify-between items-center mt-8 gap-3 max-[560px]:flex-col-reverse max-[560px]:[&>*]:w-full max-[560px]:[&>*]:text-center max-[560px]:[&>*]:justify-center">
        <button type="button" className="btn-outline" onClick={() => setStep(1)}>
          &larr; 이전
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!canProceed}
          onClick={() => setStep(3)}
        >
          다음 단계 &rarr;
        </button>
      </div>
    </div>
  );
}
