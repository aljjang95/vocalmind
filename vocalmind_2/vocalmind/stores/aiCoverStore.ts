import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VoiceModel, AiCoverStep } from '@/types';

interface AiCoverState {
  currentStep: AiCoverStep;
  selectedModelId: string | null;
  selectedModel: VoiceModel | null;
  conversionId: string | null;

  setStep: (step: AiCoverStep) => void;
  selectModel: (model: VoiceModel) => void;
  setConversionId: (id: string | null) => void;
  reset: () => void;
}

export const useAiCoverStore = create<AiCoverState>()(
  persist(
    (set) => ({
      currentStep: 'record',
      selectedModelId: null,
      selectedModel: null,
      conversionId: null,

      setStep: (step) => set({ currentStep: step }),
      selectModel: (model) => set({ selectedModelId: model.id, selectedModel: model }),
      setConversionId: (id) => set({ conversionId: id }),
      reset: () => set({
        currentStep: 'record',
        selectedModelId: null,
        selectedModel: null,
        conversionId: null,
      }),
    }),
    {
      name: 'ai-cover-store',
      partialize: (state) => ({
        selectedModelId: state.selectedModelId,
      }),
    }
  )
);
