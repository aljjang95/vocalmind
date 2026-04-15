'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient } from '@/lib/supabase/client';
import type { OnboardingResult, Plan } from '@/types';

interface OnboardingState {
  step: number;
  isAnalyzing: boolean;
  isPlayingTts: boolean;
  error: string | null;
  result: OnboardingResult | null;
  selectedPlan: Plan | null;

  setStep: (step: number) => void;
  setAnalyzing: (v: boolean) => void;
  setPlayingTts: (v: boolean) => void;
  setError: (err: string | null) => void;
  setResult: (result: OnboardingResult) => void;
  setSelectedPlan: (plan: Plan) => void;
  saveToSupabase: () => Promise<void>;
  loadFromSupabase: () => Promise<void>;
  resetAll: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      step: 0,
      isAnalyzing: false,
      isPlayingTts: false,
      error: null,
      result: null,
      selectedPlan: null,

      setStep: (step) => set({ step }),
      setAnalyzing: (v) => set({ isAnalyzing: v }),
      setPlayingTts: (v) => set({ isPlayingTts: v }),
      setError: (err) => set({ error: err }),
      setResult: (result) => set({ result }),
      setSelectedPlan: (plan) => set({ selectedPlan: plan }),

      saveToSupabase: async () => {
        try {
          const { result } = get();
          if (!result) return;
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          await supabase
            .from('profiles')
            .update({ onboarding_result: result })
            .eq('id', user.id);
        } catch {
          // Supabase 미연결 시 무시
        }
      },

      loadFromSupabase: async () => {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data } = await supabase
            .from('profiles')
            .select('onboarding_result')
            .eq('id', user.id)
            .single();
          if (data?.onboarding_result && !get().result) {
            set({ result: data.onboarding_result as OnboardingResult });
          }
        } catch {
          // 무시
        }
      },

      resetAll: () =>
        set({
          step: 0,
          isAnalyzing: false,
          isPlayingTts: false,
          error: null,
          result: null,
          selectedPlan: null,
        }),
    }),
    {
      name: 'vocalmind-onboarding',
      partialize: (state) => ({ result: state.result, selectedPlan: state.selectedPlan }),
    }
  )
);
