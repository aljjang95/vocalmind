import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BreathMode, BreathData, BreathRecord } from '@/types';

interface BreathingState {
  // 상태
  mode: BreathMode;
  isActive: boolean;
  currentPhaseIndex: number;
  breathData: BreathData | null;
  currentExhaleDuration: number;
  sessionBest: number;
  records: BreathRecord[];

  // 액션
  setMode: (mode: BreathMode) => void;
  setActive: (v: boolean) => void;
  setCurrentPhase: (index: number) => void;
  setBreathData: (data: BreathData | null) => void;
  updateExhaleDuration: (duration: number) => void;
  saveRecord: (record: BreathRecord) => void;
  resetSession: () => void;
}

export const useBreathingStore = create<BreathingState>()(
  persist(
    (set) => ({
      mode: 'long',
      isActive: false,
      currentPhaseIndex: 0,
      breathData: null,
      currentExhaleDuration: 0,
      sessionBest: 0,
      records: [],

      setMode: (mode) => set({ mode }),
      setActive: (v) => set({ isActive: v }),
      setCurrentPhase: (index) => set({ currentPhaseIndex: index }),
      setBreathData: (data) => set({ breathData: data }),
      updateExhaleDuration: (duration) =>
        set((s) => ({
          currentExhaleDuration: duration,
          sessionBest: duration > s.sessionBest ? duration : s.sessionBest,
        })),
      saveRecord: (record) =>
        set((s) => ({ records: [...s.records, record] })),
      resetSession: () =>
        set({
          isActive: false,
          currentPhaseIndex: 0,
          breathData: null,
          currentExhaleDuration: 0,
          sessionBest: 0,
        }),
    }),
    {
      name: 'vocalmind-breathing',
      partialize: (state) => ({
        records: state.records,
      }),
    }
  )
);
