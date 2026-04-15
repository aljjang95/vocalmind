import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  CoachPhase,
  CoachCondition,
  CoachFeedback,
  CoachSession,
  NoteScore,
  PatternScore,
  StageProgress,
} from '@/types';

interface CoachState {
  // 세션 (비영속)
  phase: CoachPhase;
  condition: CoachCondition | null;
  currentStageId: number;
  currentBpm: number;
  currentRootNote: number;
  failStreak: number;
  isPlaying: boolean;
  currentNoteScores: NoteScore[];
  currentPatternScores: PatternScore[];
  lastScore: number;
  lastFeedback: CoachFeedback | null;
  sessionStartTime: number | null;

  // 영속 데이터
  progress: Record<number, StageProgress>;
  sessionHistory: CoachSession[];

  // 액션
  setPhase: (phase: CoachPhase) => void;
  setCondition: (condition: CoachCondition | null) => void;
  startLesson: (stageId: number, bpm: number) => void;
  addNoteScore: (noteScore: NoteScore) => void;
  completePattern: (rootNote: number, noteScores: NoteScore[]) => void;
  completeLesson: (score: number) => void;
  passStage: (stageId: number, score: number, bpm: number) => void;
  failStage: () => void;
  lowerBpm: (bpmMin: number) => void;
  setFeedback: (feedback: CoachFeedback) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentRootNote: (rootNote: number) => void;
  resetSession: () => void;
  getNextStageId: () => number;
  getCurrentStageProgress: () => StageProgress | null;
}

export const useCoachStore = create<CoachState>()(
  persist(
    (set, get) => ({
      // 세션 (비영속)
      phase: 'home' as CoachPhase,
      condition: null,
      currentStageId: 1,
      currentBpm: 100,
      currentRootNote: 48,
      failStreak: 0,
      isPlaying: false,
      currentNoteScores: [],
      currentPatternScores: [],
      lastScore: 0,
      lastFeedback: null,
      sessionStartTime: null,

      // 영속 데이터
      progress: {},
      sessionHistory: [],

      // 액션
      setPhase: (phase) => set({ phase }),

      setCondition: (condition) => set({ condition }),

      startLesson: (stageId, bpm) =>
        set({
          currentStageId: stageId,
          currentBpm: bpm,
          currentNoteScores: [],
          currentPatternScores: [],
          lastScore: 0,
          lastFeedback: null,
          isPlaying: true,
          sessionStartTime: Date.now(),
        }),

      addNoteScore: (noteScore) =>
        set((s) => ({
          currentNoteScores: [...s.currentNoteScores, noteScore],
        })),

      completePattern: (rootNote, noteScores) =>
        set((s) => {
          const average =
            noteScores.length > 0
              ? Math.round(
                  noteScores.reduce((sum, ns) => sum + ns.score, 0) /
                    noteScores.length
                )
              : 0;
          const patternScore: PatternScore = { rootNote, noteScores, average };
          return {
            currentPatternScores: [...s.currentPatternScores, patternScore],
          };
        }),

      completeLesson: (score) =>
        set((s) => {
          const stageId = s.currentStageId;
          const existing = s.progress[stageId];
          const newProgress: StageProgress = {
            stageId,
            status: existing?.status ?? 'in_progress',
            bestScore: existing
              ? Math.max(existing.bestScore, score)
              : score,
            attempts: existing ? existing.attempts + 1 : 1,
            passedAt: existing?.passedAt ?? null,
            lastFeedback: existing?.lastFeedback ?? null,
            teacherApproved: existing?.teacherApproved ?? false,
          };
          return {
            lastScore: score,
            isPlaying: false,
            progress: { ...s.progress, [stageId]: newProgress },
          };
        }),

      passStage: (stageId, score, _bpm) =>
        set((s) => {
          const existing = s.progress[stageId];
          const newProgress: StageProgress = {
            stageId,
            status: 'passed',
            bestScore: existing
              ? Math.max(existing.bestScore, score)
              : score,
            attempts: existing ? existing.attempts : 1,
            passedAt: existing?.passedAt ?? new Date().toISOString(),
            lastFeedback: existing?.lastFeedback ?? null,
            teacherApproved: existing?.teacherApproved ?? false,
          };
          return {
            failStreak: 0,
            progress: { ...s.progress, [stageId]: newProgress },
          };
        }),

      failStage: () =>
        set((s) => ({
          failStreak: s.failStreak + 1,
        })),

      lowerBpm: (bpmMin) =>
        set((s) => ({
          currentBpm: Math.max(bpmMin, Math.round(s.currentBpm * 0.9)),
        })),

      setFeedback: (feedback) => set({ lastFeedback: feedback }),

      setIsPlaying: (isPlaying) => set({ isPlaying }),

      setCurrentRootNote: (rootNote) => set({ currentRootNote: rootNote }),

      resetSession: () =>
        set({
          phase: 'home',
          condition: null,
          currentStageId: 1,
          currentBpm: 100,
          currentRootNote: 48,
          failStreak: 0,
          isPlaying: false,
          currentNoteScores: [],
          currentPatternScores: [],
          lastScore: 0,
          lastFeedback: null,
          sessionStartTime: null,
        }),

      getNextStageId: () => {
        const { progress } = get();
        for (let id = 1; id <= 50; id++) {
          const p = progress[id];
          if (!p || !p.passedAt) return id;
        }
        return 50;
      },

      getCurrentStageProgress: () => {
        const { currentStageId, progress } = get();
        return progress[currentStageId] ?? null;
      },
    }),
    {
      name: 'vocalmind-coach',
      partialize: (state) => ({
        progress: state.progress,
        sessionHistory: state.sessionHistory,
      }),
    }
  )
);
