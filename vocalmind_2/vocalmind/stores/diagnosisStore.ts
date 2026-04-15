'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  BasicInfo,
  SelfEvalScores,
  ConcernKey,
  DiagnosisResult,
} from '@/types';

interface DiagnosisState {
  // 폼 데이터 (persist 안 함 - 아래 partialize에서 제외)
  step: number;
  basicInfo: BasicInfo;
  concerns: ConcernKey[];
  goal: string;
  selfEval: SelfEvalScores;
  isSubmitting: boolean;
  error: string | null;

  // 결과 (persist)
  result: DiagnosisResult | null;

  // 액션
  setStep: (step: number) => void;
  setBasicInfo: (info: Partial<BasicInfo>) => void;
  setConcerns: (concerns: ConcernKey[]) => void;
  setGoal: (goal: string) => void;
  setSelfEval: (scores: Partial<SelfEvalScores>) => void;
  setSubmitting: (v: boolean) => void;
  setError: (err: string | null) => void;
  setResult: (result: DiagnosisResult) => void;
  resetForm: () => void;
  resetAll: () => void;
}

const initialBasicInfo: BasicInfo = {
  nickname: '',
  voiceType: '중음',
  experience: '초보',
  genre: '',
};

const initialSelfEval: SelfEvalScores = {
  pitch: 50,
  breath: 50,
  power: 50,
  tone: 50,
  technique: 50,
};

export const useDiagnosisStore = create<DiagnosisState>()(
  persist(
    (set) => ({
      step: 0,
      basicInfo: { ...initialBasicInfo },
      concerns: [],
      goal: '',
      selfEval: { ...initialSelfEval },
      isSubmitting: false,
      error: null,
      result: null,

      setStep: (step) => set({ step }),
      setBasicInfo: (info) =>
        set((s) => ({ basicInfo: { ...s.basicInfo, ...info } })),
      setConcerns: (concerns) => set({ concerns }),
      setGoal: (goal) => set({ goal }),
      setSelfEval: (scores) =>
        set((s) => ({ selfEval: { ...s.selfEval, ...scores } })),
      setSubmitting: (v) => set({ isSubmitting: v }),
      setError: (err) => set({ error: err }),
      setResult: (result) => set({ result }),
      resetForm: () =>
        set({
          step: 0,
          basicInfo: { ...initialBasicInfo },
          concerns: [],
          goal: '',
          selfEval: { ...initialSelfEval },
          isSubmitting: false,
          error: null,
        }),
      resetAll: () =>
        set({
          step: 0,
          basicInfo: { ...initialBasicInfo },
          concerns: [],
          goal: '',
          selfEval: { ...initialSelfEval },
          isSubmitting: false,
          error: null,
          result: null,
        }),
    }),
    {
      name: 'vocalmind-diagnosis',
      partialize: (state) => ({ result: state.result }),
    }
  )
);
