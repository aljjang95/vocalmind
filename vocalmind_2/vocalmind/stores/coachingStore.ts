'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Message, MessageRole } from '@/types';

interface CoachingState {
  // 커리큘럼 진행
  currentCategoryId: string;
  currentLessonId: string;
  completedLessons: string[];

  // 채팅 세션
  messages: Message[];
  isLoading: boolean;

  // 액션
  setCurrentCategory: (id: string) => void;
  setCurrentLesson: (id: string) => void;
  completeLesson: (id: string) => void;
  append: (role: MessageRole, content: string) => void;
  setLoading: (v: boolean) => void;
  clearMessages: () => void;
  resetAll: () => void;
}

export const useCoachingStore = create<CoachingState>()(
  persist(
    (set) => ({
      currentCategoryId: 'breathing',
      currentLessonId: 'breathing-1',
      completedLessons: [],
      messages: [],
      isLoading: false,

      setCurrentCategory: (id) => set({ currentCategoryId: id }),
      setCurrentLesson: (id) => set({ currentLessonId: id }),
      completeLesson: (id) =>
        set((s) => ({
          completedLessons: s.completedLessons.includes(id)
            ? s.completedLessons
            : [...s.completedLessons, id],
        })),
      append: (role, content) =>
        set((s) => ({
          messages: [
            ...s.messages,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              role,
              content,
              createdAt: new Date(),
            },
          ],
        })),
      setLoading: (v) => set({ isLoading: v }),
      clearMessages: () => set({ messages: [] }),
      resetAll: () =>
        set({
          currentCategoryId: 'breathing',
          currentLessonId: 'breathing-1',
          completedLessons: [],
          messages: [],
          isLoading: false,
        }),
    }),
    {
      name: 'vocalmind-coaching',
      partialize: (state) => ({
        currentCategoryId: state.currentCategoryId,
        currentLessonId: state.currentLessonId,
        completedLessons: state.completedLessons,
      }),
    }
  )
);
