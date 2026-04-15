'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VocalDna, DnaAxis } from '@/types';

interface VocalDnaState {
  dna: VocalDna | null;
  isAnalyzing: boolean;
  error: string | null;
  analyzeDna: (audioBlob: Blob) => Promise<void>;
  fetchDna: () => Promise<void>;
  getDnaAxes: () => DnaAxis[];
  clearError: () => void;
}

function buildDnaAxes(dna: VocalDna): DnaAxis[] {
  return [
    { key: 'laryngeal', label: '후두', value: dna.laryngeal },
    { key: 'tongue_root', label: '혀뿌리', value: dna.tongue_root },
    { key: 'jaw', label: '턱', value: dna.jaw },
    { key: 'register_break', label: '성구전환', value: dna.register_break },
    { key: 'tone_stability', label: '음색안정', value: dna.tone_stability },
  ];
}

export const useVocalDnaStore = create<VocalDnaState>()(
  persist(
    (set, get) => ({
      dna: null,
      isAnalyzing: false,
      error: null,

      clearError: () => set({ error: null }),

      analyzeDna: async (audioBlob: Blob) => {
        set({ isAnalyzing: true, error: null });
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const res = await fetch('/api/vocal-dna', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            throw new Error(body.error ?? `서버 오류 (${res.status})`);
          }

          const data = await res.json() as VocalDna;
          set({ dna: data, isAnalyzing: false });
        } catch (err) {
          const msg = err instanceof Error ? err.message : '분석에 실패했습니다.';
          set({ error: msg, isAnalyzing: false });
        }
      },

      fetchDna: async () => {
        set({ error: null });
        try {
          const res = await fetch('/api/vocal-dna', { method: 'GET' });
          if (res.status === 404) {
            // DNA 없음 — 정상 상태
            set({ dna: null });
            return;
          }
          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            throw new Error(body.error ?? `서버 오류 (${res.status})`);
          }
          const data = await res.json() as VocalDna;
          set({ dna: data });
        } catch (err) {
          const msg = err instanceof Error ? err.message : '데이터 로드에 실패했습니다.';
          set({ error: msg });
        }
      },

      getDnaAxes: (): DnaAxis[] => {
        const { dna } = get();
        if (!dna) return [];
        return buildDnaAxes(dna);
      },
    }),
    {
      name: 'vocalmind-vocal-dna',
      partialize: (state) => ({ dna: state.dna }),
    },
  ),
);
