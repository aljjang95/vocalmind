'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Plan } from '@/types';

interface BillingState {
  plan: Plan;
  apiUsageWon: number;
  apiResetDate: string;
  setPlan: (plan: Plan) => void;
  addApiUsage: (won: number) => void;
  canUseApi: () => boolean;
  getApiLimit: () => number;
  showAds: () => boolean;
  canAccessStage: (stageId: number) => boolean;
  canUploadOwnSong: () => boolean;
  syncFromServer: () => Promise<void>;
}

export const useBillingStore = create<BillingState>()(
  persist(
    (set, get) => ({
      plan: 'free' as Plan,
      apiUsageWon: 0,
      apiResetDate: '',

      setPlan: (plan) => set({ plan }),

      addApiUsage: (won) => set((s) => ({ apiUsageWon: s.apiUsageWon + won })),

      getApiLimit: () => {
        const { plan } = get();
        if (plan === 'hobby') return 5000;
        if (plan === 'pro') return 10000;
        return 0;
      },

      canUseApi: () => {
        const { apiUsageWon } = get();
        const limit = get().getApiLimit();
        return limit > 0 && apiUsageWon < limit;
      },

      showAds: () => get().plan === 'free',

      canAccessStage: (stageId) => {
        const { plan } = get();
        if (stageId <= 3) return true;
        if (plan === 'hobby') return stageId <= 5;
        if (plan === 'pro') return true;
        return false;
      },

      canUploadOwnSong: () => get().plan !== 'free',

      syncFromServer: async () => {
        try {
          const res = await fetch('/api/payment/plan');
          if (res.ok) {
            const data = await res.json();
            set({
              plan: data.plan ?? 'free',
              apiUsageWon: data.apiUsageWon ?? 0,
              apiResetDate: data.apiResetDate ?? '',
            });
          }
        } catch {
          // 서버 동기화 실패 시 로컬 상태 유지
        }
      },
    }),
    {
      name: 'hlb-billing',
      partialize: (s) => ({ plan: s.plan, apiUsageWon: s.apiUsageWon, apiResetDate: s.apiResetDate }),
    },
  ),
);
