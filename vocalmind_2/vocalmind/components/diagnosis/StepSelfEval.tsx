'use client';

import { useDiagnosisStore } from '@/stores/diagnosisStore';
import { SelfEvalScores } from '@/types';

const EVAL_ITEMS: { key: keyof SelfEvalScores; label: string; desc: string }[] = [
  { key: 'pitch', label: '음정 정확도', desc: '멜로디를 정확히 따라 부를 수 있나요?' },
  { key: 'breath', label: '호흡 안정성', desc: '긴 프레이즈에서 숨이 모자라지 않나요?' },
  { key: 'power', label: '성량 / 파워', desc: '충분한 볼륨으로 소리를 낼 수 있나요?' },
  { key: 'tone', label: '음색 만족도', desc: '자신의 목소리 톤에 만족하나요?' },
  { key: 'technique', label: '테크닉 숙련도', desc: '비브라토, 팔세토 등 기법을 구사할 수 있나요?' },
];

export default function StepSelfEval() {
  const { selfEval, setSelfEval, setStep } = useDiagnosisStore();

  return (
    <div className="animate-[slideIn_0.4s_ease-out]">
      <h2 className="text-[1.6rem] max-md:text-[1.3rem] font-bold mb-2">자기 평가를 해주세요</h2>
      <p className="text-[0.9rem] text-[var(--text2)] mb-7 leading-relaxed">각 항목에 대해 본인의 수준을 슬라이더로 평가해주세요.</p>

      <div className="flex flex-col gap-7 my-2">
        {EVAL_ITEMS.map((item) => (
          <div key={item.key} className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-[0.92rem] font-semibold text-[var(--text)]">{item.label}</span>
              <span className="font-mono text-[0.92rem] font-medium text-[var(--accent)] min-w-[32px] text-right">{selfEval[item.key]}</span>
            </div>
            <p className="text-[0.78rem] text-[var(--text2)] mb-1">{item.desc}</p>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={selfEval[item.key]}
              onChange={(e) => setSelfEval({ [item.key]: Number(e.target.value) })}
              className="w-full h-1.5 bg-[var(--surface2)] rounded-[3px] outline-none cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-[var(--accent)] [&::-webkit-slider-thumb]:to-[var(--accent2)] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-[0_2px_10px_rgba(59,130,246,0.4)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-[1.15]"
            />
            <div className="flex justify-between text-[0.68rem] text-[var(--muted)] px-0.5">
              <span>부족</span>
              <span>보통</span>
              <span>능숙</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-8 gap-3 max-[560px]:flex-col-reverse max-[560px]:[&>*]:w-full max-[560px]:[&>*]:text-center max-[560px]:[&>*]:justify-center">
        <button type="button" className="btn-outline" onClick={() => setStep(2)}>
          &larr; 이전
        </button>
        <button type="button" className="btn-primary" onClick={() => setStep(4)}>
          진단 결과 보기 &rarr;
        </button>
      </div>
    </div>
  );
}
