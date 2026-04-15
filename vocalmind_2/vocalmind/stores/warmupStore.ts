import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WarmupCondition, WarmupRoutine, WarmupRecord } from '@/types';

interface WarmupState {
  // 상태
  condition: WarmupCondition | null;
  routine: WarmupRoutine | null;
  isGenerating: boolean;
  error: string | null;
  currentStageIndex: number;
  records: WarmupRecord[];

  // 액션
  setCondition: (condition: WarmupCondition | null) => void;
  setRoutine: (routine: WarmupRoutine | null) => void;
  setGenerating: (v: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentStage: (index: number) => void;
  completeStage: (stageId: number) => void;
  addRecord: (record: WarmupRecord) => void;
  resetRoutine: () => void;
}

export const useWarmupStore = create<WarmupState>()(
  persist(
    (set) => ({
      condition: null,
      routine: null,
      isGenerating: false,
      error: null,
      currentStageIndex: 0,
      records: [],

      setCondition: (condition) => set({ condition }),
      setRoutine: (routine) => set({ routine }),
      setGenerating: (v) => set({ isGenerating: v }),
      setError: (error) => set({ error }),
      setCurrentStage: (index) => set({ currentStageIndex: index }),
      completeStage: (stageId) =>
        set((s) => {
          if (!s.routine) return s;
          const currentRecord = s.records.find(
            (r) => r.routineId === s.routine!.id && !r.completedAt
          );
          if (currentRecord) {
            return {
              records: s.records.map((r) =>
                r.routineId === s.routine!.id && !r.completedAt
                  ? {
                      ...r,
                      stagesCompleted: r.stagesCompleted.includes(stageId)
                        ? r.stagesCompleted
                        : [...r.stagesCompleted, stageId],
                    }
                  : r
              ),
            };
          }
          return {
            records: [
              ...s.records,
              {
                routineId: s.routine.id,
                completedAt: '',
                stagesCompleted: [stageId],
              },
            ],
          };
        }),
      addRecord: (record) =>
        set((s) => ({ records: [...s.records, record] })),
      resetRoutine: () =>
        set({
          condition: null,
          routine: null,
          isGenerating: false,
          error: null,
          currentStageIndex: 0,
        }),
    }),
    {
      name: 'vocalmind-warmup',
      partialize: (state) => ({
        records: state.records,
      }),
    }
  )
);
