'use client';

import { useOnboardingStore } from '@/stores/onboardingStore';
import StepRecording from './StepRecording';
import StepAnalyzing from './StepAnalyzing';
import StepResult from './StepResult';
import StepRoadmap from './StepRoadmap';
import StepPlanChoice from './StepPlanChoice';
import StepTransition from './StepTransition';

const STEP_LABELS = ['녹음', '분석', '결과', '로드맵', '플랜', '시작'];

export default function OnboardingWizard() {
  const { step, error, result, setError } = useOnboardingStore();

  // result가 있으면 step 2 이상으로 점프 가능
  const displayStep = result && step < 2 ? 2 : step;

  return (
    <div className="max-w-[680px] mx-auto py-8 max-[560px]:py-5">
      {/* 진행 바 */}
      <div className="flex items-start justify-between mb-10 relative px-2">
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2 z-[1]"
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 border-2 ${
                i === displayStep
                  ? 'border-[var(--accent)] bg-[rgba(59,130,246,0.12)] text-[var(--accent)] shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  : i < displayStep
                  ? 'border-[var(--success)] bg-[rgba(34,197,94,0.14)] text-[var(--success-lt)]'
                  : 'bg-[var(--bg3)] border-[var(--border2)] text-[var(--muted)]'
              }`}
            >
              {i < displayStep ? <span>&#10003;</span> : <span>{i + 1}</span>}
            </div>
            <span
              className={`text-[0.68rem] whitespace-nowrap max-[768px]:hidden ${
                i === displayStep
                  ? 'text-[var(--accent)] font-semibold'
                  : i < displayStep
                  ? 'text-[var(--success-lt)]'
                  : 'text-[var(--muted)]'
              }`}
            >
              {label}
            </span>
          </div>
        ))}
        <div className="absolute top-4 left-8 right-8 h-0.5 bg-[var(--border)] z-0">
          <div
            className="h-full bg-[var(--accent)] rounded-[1px] transition-[width] duration-400 ease-out"
            style={{ width: `${(displayStep / (STEP_LABELS.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className="flex items-center gap-2.5 px-[18px] py-3.5 bg-[rgba(244,63,94,0.1)] border border-[rgba(244,63,94,0.25)] rounded-[var(--r-xs)] text-[var(--error)] text-[0.85rem] mb-5">
          <span>&#9888;</span> {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto bg-transparent border-none text-[var(--error)] cursor-pointer text-[0.9rem] px-1.5 py-0.5"
          >
            &#10005;
          </button>
        </div>
      )}

      {/* 단계별 콘텐츠 */}
      {displayStep === 0 && <StepRecording />}
      {displayStep === 1 && <StepAnalyzing />}
      {displayStep === 2 && <StepResult />}
      {displayStep === 3 && <StepRoadmap />}
      {displayStep === 4 && <StepPlanChoice />}
      {displayStep === 5 && <StepTransition />}
    </div>
  );
}
