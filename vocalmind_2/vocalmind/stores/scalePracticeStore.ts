'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FeedbackMode, KeyLabel, LessonMode, LessonPhase, ScalePracticeScore } from '@/types';

interface ScalePracticeState {
  // 스케일 설정
  pattern: number[];
  startNote: string;
  bpm: number;
  transposeRange: [number, number];
  // 재생 상태
  isPlaying: boolean;
  isRecording: boolean;
  currentNote: number | null;
  currentTranspose: number;
  detectedPitch: number | null;
  feedbackMode: FeedbackMode;
  metronomeOn: boolean;
  keyLabel: KeyLabel;
  // 레슨 모드
  lessonMode: LessonMode;
  lessonPhase: LessonPhase;
  unlockedStages: number[];
  latestScore: ScalePracticeScore | null;
  retryCount: number;
  // 액션
  setPattern: (p: number[]) => void;
  setStartNote: (n: string) => void;
  setBpm: (b: number) => void;
  setTransposeRange: (r: [number, number]) => void;
  setIsPlaying: (v: boolean) => void;
  setIsRecording: (v: boolean) => void;
  setCurrentNote: (n: number | null) => void;
  setCurrentTranspose: (t: number) => void;
  setDetectedPitch: (p: number | null) => void;
  setFeedbackMode: (m: FeedbackMode) => void;
  setMetronomeOn: (v: boolean) => void;
  setKeyLabel: (l: KeyLabel) => void;
  setLessonMode: (m: LessonMode) => void;
  setLessonPhase: (p: LessonPhase) => void;
  setLatestScore: (s: ScalePracticeScore | null) => void;
  setRetryCount: (n: number) => void;
  unlockStage: (stageId: number) => void;
  isStageUnlocked: (stageId: number) => boolean;
}

const MAJOR_ROUNDING = [0, 2, 4, 5, 7, 5, 4, 2, 0];

export const useScalePracticeStore = create<ScalePracticeState>()(
  persist(
    (set, get) => ({
      pattern: MAJOR_ROUNDING,
      startNote: 'C3',
      bpm: 80,
      transposeRange: [-3, 8],
      isPlaying: false,
      isRecording: false,
      currentNote: null,
      currentTranspose: 0,
      detectedPitch: null,
      feedbackMode: 'quiet',
      metronomeOn: false,
      keyLabel: 'solfege',
      lessonMode: 'auto',
      lessonPhase: 'guide',
      unlockedStages: [1],
      latestScore: null,
      retryCount: 0,
      setPattern: (p) => set({ pattern: p }),
      setStartNote: (n) => set({ startNote: n }),
      setBpm: (b) => set({ bpm: b }),
      setTransposeRange: (r) => set({ transposeRange: r }),
      setIsPlaying: (v) => set({ isPlaying: v }),
      setIsRecording: (v) => set({ isRecording: v }),
      setCurrentNote: (n) => set({ currentNote: n }),
      setCurrentTranspose: (t) => set({ currentTranspose: t }),
      setDetectedPitch: (p) => set({ detectedPitch: p }),
      setFeedbackMode: (m) => set({ feedbackMode: m }),
      setMetronomeOn: (v) => set({ metronomeOn: v }),
      setKeyLabel: (l) => set({ keyLabel: l }),
      setLessonMode: (m) => set({ lessonMode: m }),
      setLessonPhase: (p) => set({ lessonPhase: p }),
      setLatestScore: (s) => set({ latestScore: s }),
      setRetryCount: (n) => set({ retryCount: n }),
      unlockStage: (stageId) => set((state) => ({
        unlockedStages: state.unlockedStages.includes(stageId)
          ? state.unlockedStages
          : [...state.unlockedStages, stageId].sort((a, b) => a - b),
      })),
      isStageUnlocked: (stageId) => get().unlockedStages.includes(stageId),
    }),
    {
      name: 'vocalmind-scale-practice',
      partialize: (s) => ({
        pattern: s.pattern,
        startNote: s.startNote,
        bpm: s.bpm,
        transposeRange: s.transposeRange,
        feedbackMode: s.feedbackMode,
        metronomeOn: s.metronomeOn,
        keyLabel: s.keyLabel,
        unlockedStages: s.unlockedStages,
      }),
    },
  ),
);
