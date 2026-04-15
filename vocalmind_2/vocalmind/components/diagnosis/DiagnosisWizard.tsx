'use client';

import { useEffect, useCallback } from 'react';
import { useDiagnosisStore } from '@/stores/diagnosisStore';
import StepBasicInfo from './StepBasicInfo';
import StepConcerns from './StepConcerns';
import StepGoals from './StepGoals';
import StepSelfEval from './StepSelfEval';
import DiagnosisResultView from './DiagnosisResult';

const STEP_LABELS = ['기본정보', '고민', '목표', '자기평가'];

export default function DiagnosisWizard() {
  const {
    step,
    basicInfo,
    concerns,
    goal,
    selfEval,
    isSubmitting,
    error,
    result,
    setStep,
    setSubmitting,
    setError,
    setResult,
    resetAll,
  } = useDiagnosisStore();

  const submitDiagnosis = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          basicInfo,
          concerns,
          goal,
          selfEval,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(msg);
      setStep(3);
    } finally {
      setSubmitting(false);
    }
  }, [basicInfo, concerns, goal, selfEval, setSubmitting, setError, setResult, setStep]);

  useEffect(() => {
    if (step === 4 && !result && !isSubmitting) {
      submitDiagnosis();
    }
  }, [step, result, isSubmitting, submitDiagnosis]);

  if (result) {
    return (
      <div className="max-w-[680px] mx-auto py-8 max-[560px]:py-5">
        <DiagnosisResultView result={result} onRetry={resetAll} />
      </div>
    );
  }

  if (step === 4 && isSubmitting) {
    return (
      <div className="max-w-[680px] mx-auto py-8 max-[560px]:py-5">
        <div className="flex flex-col items-center justify-center min-h-[320px] gap-5 text-center">
          <div className="w-12 h-12 border-[3px] border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
          <h3 className="text-[1.3rem] font-bold">AI가 보컬을 분석하고 있어요</h3>
          <p className="text-[0.88rem] text-[var(--text2)]">잠시만 기다려주세요. 맞춤 진단 결과를 생성하고 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[680px] mx-auto py-8 max-[560px]:py-5">
      {/* 진행 바 */}
      <div className="flex items-start justify-between mb-10 relative px-2">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-2 z-[1]">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
              i === step
                ? 'border-2 border-[var(--accent)] bg-blue-500/[0.12] text-[var(--accent)] shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                : i < step
                  ? 'border-2 border-[var(--success)] bg-green-500/[0.14] text-[var(--success-lt)]'
                  : 'border-2 border-[var(--border2)] bg-[var(--bg3)] text-[var(--muted)]'
            }`}>
              {i < step ? <span>&#10003;</span> : <span>{i + 1}</span>}
            </div>
            <span className={`text-[0.68rem] whitespace-nowrap max-md:hidden ${
              i === step ? 'text-[var(--accent)] font-semibold' : i < step ? 'text-[var(--success-lt)]' : 'text-[var(--muted)]'
            }`}>{label}</span>
          </div>
        ))}
        <div className="absolute top-4 left-8 right-8 h-0.5 bg-[var(--border)] z-0">
          <div className="h-full bg-[var(--accent)] rounded-sm transition-[width] duration-400 ease-out" style={{ width: `${(step / (STEP_LABELS.length - 1)) * 100}%` }} />
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className="flex items-center gap-2.5 px-[18px] py-3.5 bg-rose-500/10 border border-rose-500/25 rounded-[var(--r-xs)] text-[var(--error)] text-[0.85rem] mb-5">
          <span>&#9888;</span> {error}
          <button type="button" onClick={() => setError(null)} className="ml-auto bg-transparent border-none text-[var(--error)] cursor-pointer text-[0.9rem] px-1.5 py-0.5">&#10005;</button>
        </div>
      )}

      {/* 단계별 콘텐츠 */}
      {step === 0 && <StepBasicInfo />}
      {step === 1 && <StepConcerns />}
      {step === 2 && <StepGoals />}
      {step === 3 && <StepSelfEval />}
    </div>
  );
}
