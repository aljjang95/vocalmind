'use client';

import { create } from 'zustand';
import type { AuditionEvent, AuditionEntry } from '@/types';

interface AuditionState {
  event: AuditionEvent | null;
  entries: AuditionEntry[];
  myEntry: AuditionEntry | null;
  isLoading: boolean;
  error: string | null;

  fetchEvent: () => Promise<void>;
  fetchEntries: () => Promise<void>;
  submitEntry: (audioBlob: Blob) => Promise<void>;
  voteEntry: (entryId: string) => Promise<void>;
  unvoteEntry: (entryId: string) => Promise<void>;
}

export const useAuditionStore = create<AuditionState>((set, get) => ({
  event: null,
  entries: [],
  myEntry: null,
  isLoading: false,
  error: null,

  fetchEvent: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/audition');
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { event: AuditionEvent | null };
      set({ event: data.event });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '오디션 정보를 불러오지 못했습니다.' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchEntries: async () => {
    const { event } = get();
    if (!event) return;
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/audition?entries=true');
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as {
        event: AuditionEvent | null;
        entries: AuditionEntry[];
        myEntry: AuditionEntry | null;
      };
      set({ event: data.event, entries: data.entries, myEntry: data.myEntry });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '참가자 목록을 불러오지 못했습니다.' });
    } finally {
      set({ isLoading: false });
    }
  },

  submitEntry: async (audioBlob) => {
    const { event } = get();
    if (!event) throw new Error('오디션 이벤트가 없습니다.');

    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'audition.webm');
      formData.append('eventId', event.id);

      const res = await fetch('/api/audition', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { entry: AuditionEntry };
      set({ myEntry: data.entry });
      // 참가 후 목록 갱신
      await get().fetchEntries();
    } catch (err) {
      const message = err instanceof Error ? err.message : '참가 신청에 실패했습니다.';
      set({ error: message });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  voteEntry: async (entryId) => {
    // 낙관적 업데이트
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === entryId
          ? { ...e, vote_count: e.vote_count + 1, has_voted: true }
          : e,
      ),
    }));

    try {
      const res = await fetch('/api/audition/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      });
      if (!res.ok) {
        // 롤백
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === entryId
              ? { ...e, vote_count: Math.max(0, e.vote_count - 1), has_voted: false }
              : e,
          ),
        }));
      }
    } catch {
      // 롤백
      set((state) => ({
        entries: state.entries.map((e) =>
          e.id === entryId
            ? { ...e, vote_count: Math.max(0, e.vote_count - 1), has_voted: false }
            : e,
        ),
      }));
    }
  },

  unvoteEntry: async (entryId) => {
    // 낙관적 업데이트
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === entryId
          ? { ...e, vote_count: Math.max(0, e.vote_count - 1), has_voted: false }
          : e,
      ),
    }));

    try {
      const res = await fetch('/api/audition/vote', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId }),
      });
      if (!res.ok) {
        // 롤백
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === entryId
              ? { ...e, vote_count: e.vote_count + 1, has_voted: true }
              : e,
          ),
        }));
      }
    } catch {
      // 롤백
      set((state) => ({
        entries: state.entries.map((e) =>
          e.id === entryId
            ? { ...e, vote_count: e.vote_count + 1, has_voted: true }
            : e,
        ),
      }));
    }
  },
}));
