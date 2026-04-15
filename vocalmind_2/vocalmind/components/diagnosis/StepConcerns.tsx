'use client';

import { useDiagnosisStore } from '@/stores/diagnosisStore';
import { ConcernKey } from '@/types';
import { IconRocket, IconWind, IconTarget, IconFrown, IconSparkle, IconChat, IconNervous, IconChart, IconVibrato } from '@/components/shared/Icons';

const CONCERN_OPTIONS: { key: ConcernKey; label: string; icon: React.ReactNode }[] = [
  { key: 'high_notes', label: '고음이 어려워요', icon: <IconRocket size={22} /> },
  { key: 'breath_control', label: '호흡이 부족해요', icon: <IconWind size={22} /> },
  { key: 'pitch_accuracy', label: '음정이 불안정해요', icon: <IconTarget size={22} /> },
  { key: 'vocal_fatigue', label: '성대가 쉽게 피로해요', icon: <IconFrown size={22} /> },
  { key: 'tone_quality', label: '음색이 마음에 안 들어요', icon: <IconSparkle size={22} /> },
  { key: 'diction', label: '발음이 불명확해요', icon: <IconChat size={22} /> },
  { key: 'stage_fear', label: '무대에서 긴장돼요', icon: <IconNervous size={22} /> },
  { key: 'range_expand', label: '음역대를 넓히고 싶어요', icon: <IconChart size={22} /> },
  { key: 'vibrato', label: '비브라토를 배우고 싶어요', icon: <IconVibrato size={22} /> },
];

const MAX_CONCERNS = 3;

export default function StepConcerns() {
  const { concerns, setConcerns, setStep } = useDiagnosisStore();

  const toggleConcern = (key: ConcernKey) => {
    if (concerns.includes(key)) {
      setConcerns(concerns.filter((c) => c !== key));
    } else if (concerns.length < MAX_CONCERNS) {
      setConcerns([...concerns, key]);
    }
  };

  const canProceed = concerns.length >= 1;

  return (
    <div className="animate-[slideIn_0.4s_ease-out]">
      <h2 className="text-[1.6rem] max-md:text-[1.3rem] font-bold mb-2">현재 가장 큰 고민은?</h2>
      <p className="text-[0.9rem] text-[var(--text2)] mb-7 leading-relaxed">최대 {MAX_CONCERNS}개까지 선택할 수 있어요.</p>

      <div className="grid grid-cols-3 max-md:grid-cols-2 max-[560px]:grid-cols-2 gap-2.5 my-2">
        {CONCERN_OPTIONS.map((opt) => {
          const isSelected = concerns.includes(opt.key);
          const isDisabled = !isSelected && concerns.length >= MAX_CONCERNS;
          return (
            <button
              key={opt.key}
              type="button"
              className={`flex flex-col items-center gap-2 px-3 py-[18px] border rounded-[var(--r-sm)] cursor-pointer transition-all duration-200 relative text-center ${
                isSelected
                  ? 'border-[var(--accent)] bg-blue-500/[0.08]'
                  : isDisabled
                    ? 'opacity-40 cursor-not-allowed bg-[var(--bg3)] border-[var(--border2)]'
                    : 'bg-[var(--bg3)] border-[var(--border2)] hover:border-white/20 hover:bg-[var(--surface2)]'
              }`}
              onClick={() => !isDisabled && toggleConcern(opt.key)}
              disabled={isDisabled}
            >
              <span className="text-[1.4rem] flex items-center justify-center text-[var(--accent-lt)]">{opt.icon}</span>
              <span className="text-[0.78rem] text-[var(--text2)] leading-snug">{opt.label}</span>
              {isSelected && <span className="absolute top-2 right-2.5 text-[0.72rem] text-[var(--accent)] font-bold">&#10003;</span>}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between items-center mt-8 gap-3 max-[560px]:flex-col-reverse max-[560px]:[&>*]:w-full max-[560px]:[&>*]:text-center max-[560px]:[&>*]:justify-center">
        <button type="button" className="btn-outline" onClick={() => setStep(0)}>
          &larr; 이전
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={!canProceed}
          onClick={() => setStep(2)}
        >
          다음 단계 &rarr;
        </button>
      </div>
    </div>
  );
}
