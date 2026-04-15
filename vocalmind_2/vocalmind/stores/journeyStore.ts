'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  StageProgress,
  StageStatus,
  UserTier,
  EvaluationResult,
} from '@/types';
import { hlbCurriculum } from '@/lib/data/hlbCurriculum';
import { createClient } from '@/lib/supabase/client';

interface JourneyState {
  userTier: UserTier;
  progress: Record<number, StageProgress>;
  setUserTier: (tier: UserTier) => void;
  getStageStatus: (stageId: number) => StageStatus;
  canAccessStage: (stageId: number) => boolean;
  submitEvaluation: (stageId: number, result: EvaluationResult) => void;
  teacherApprove: (stageId: number) => void;
  getNextAvailableStage: () => number | null;
  syncFromSupabase: () => Promise<void>;
}

function canAccessTier(userTier: UserTier, minTier: UserTier): boolean {
  const tierOrder: UserTier[] = ['free', 'hobby', 'pro', 'teacher'];
  return tierOrder.indexOf(userTier) >= tierOrder.indexOf(minTier);
}

/** Supabase에 진도 upsert (로그인 상태에서만 동작) */
async function syncProgressToSupabase(stageId: number, prog: StageProgress) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('progress').upsert({
      user_id: user.id,
      stage_id: stageId,
      best_score: prog.bestScore,
      attempts: prog.attempts,
      passed: prog.status === 'passed',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,stage_id' });
  } catch {
    // Supabase 미연결 시 무시 — localStorage에만 저장
  }
}

/** Supabase에 채점 기록 저장 */
async function saveEvaluationToSupabase(stageId: number, result: EvaluationResult) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('evaluations').insert({
      user_id: user.id,
      stage_id: stageId,
      score: result.score,
      pitch_accuracy: result.pitchAccuracy,
      tone_stability: result.toneStability,
      tension_detected: result.tensionDetected,
      tension_detail: result.tension?.detail ?? '',
      feedback: result.feedback,
      passed: result.passed,
    });
  } catch {
    // 무시
  }
}

export const useJourneyStore = create<JourneyState>()(
  persist(
    (set, get) => ({
      userTier: 'free' as UserTier,
      progress: {},

      setUserTier: (tier) => set({ userTier: tier }),

      getStageStatus: (stageId) => {
        const stage = hlbCurriculum.find((s) => s.id === stageId);
        if (!stage) return 'locked';
        const { userTier, progress } = get();
        if (!canAccessTier(userTier, stage.minTier)) return 'locked';
        if (stageId === 1) return progress[stageId]?.status ?? 'available';
        const prev = progress[stageId - 1];
        if (!prev || prev.status !== 'passed') return 'locked';
        return progress[stageId]?.status ?? 'available';
      },

      canAccessStage: (stageId) => {
        const status = get().getStageStatus(stageId);
        return status !== 'locked';
      },

      submitEvaluation: (stageId, result) => {
        set((state) => {
          const prev = state.progress[stageId] ?? {
            stageId,
            status: 'in_progress' as StageStatus,
            bestScore: 0,
            attempts: 0,
            passedAt: null,
            lastFeedback: null,
            teacherApproved: false,
          };
          const updated = {
            ...prev,
            bestScore: Math.max(prev.bestScore, result.score),
            attempts: prev.attempts + 1,
            lastFeedback: result.feedback,
            status: (result.passed ? 'passed' : 'in_progress') as StageStatus,
            passedAt: result.passed ? new Date().toISOString() : prev.passedAt,
          };

          // Supabase 동기화 (비동기, 실패해도 무시)
          syncProgressToSupabase(stageId, updated);
          saveEvaluationToSupabase(stageId, result);

          return {
            progress: { ...state.progress, [stageId]: updated },
          };
        });
      },

      teacherApprove: (stageId) => {
        set((state) => {
          const prev = state.progress[stageId];
          if (!prev) return state;
          return {
            progress: {
              ...state.progress,
              [stageId]: { ...prev, teacherApproved: true },
            },
          };
        });
      },

      getNextAvailableStage: () => {
        for (const stage of hlbCurriculum) {
          const status = get().getStageStatus(stage.id);
          if (status === 'available' || status === 'in_progress') return stage.id;
        }
        return null;
      },

      /** Supabase에서 진도 불러오기 (로그인 후 호출) */
      syncFromSupabase: async () => {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // 프로필에서 역할 가져오기
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (profile?.role) {
            set({ userTier: profile.role as UserTier });
          }

          // 진도 불러오기
          const { data: rows } = await supabase
            .from('progress')
            .select('*')
            .eq('user_id', user.id);
          if (!rows || rows.length === 0) return;

          const progress: Record<number, StageProgress> = {};
          for (const row of rows) {
            progress[row.stage_id] = {
              stageId: row.stage_id,
              status: row.passed ? 'passed' : 'in_progress',
              bestScore: row.best_score,
              attempts: row.attempts,
              passedAt: row.passed ? row.updated_at : null,
              lastFeedback: null,
              teacherApproved: false,
            };
          }

          // localStorage 데이터와 병합 (Supabase가 더 최신이면 덮어쓰기)
          set((state) => {
            const merged = { ...state.progress };
            for (const [id, sp] of Object.entries(progress)) {
              const local = merged[Number(id)];
              if (!local || sp.bestScore > local.bestScore) {
                merged[Number(id)] = sp;
              }
            }
            return { progress: merged };
          });
        } catch {
          // Supabase 미연결 시 무시
        }
      },
    }),
    {
      name: 'vocalmind-journey',
      partialize: (state) => ({
        userTier: state.userTier,
        progress: state.progress,
      }),
    },
  ),
);
