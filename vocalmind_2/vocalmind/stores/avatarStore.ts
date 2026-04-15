'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AvatarData, ShopItem, UserInventoryItem, UserEquipped, ItemCategory } from '@/types';

interface AvatarState {
  avatar: AvatarData | null;
  equipped: UserEquipped | null;
  inventory: UserInventoryItem[];
  shopItems: ShopItem[];
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;

  generateAvatar: (voiceType: string | null) => Promise<void>;
  fetchAvatar: () => Promise<void>;
  fetchInventory: () => Promise<void>;
  fetchEquipped: () => Promise<void>;
  fetchShopItems: () => Promise<void>;
  equipItem: (category: ItemCategory, itemId: string | null) => Promise<void>;
  clearError: () => void;
}

export const useAvatarStore = create<AvatarState>()(
  persist(
    (set) => ({
      avatar: null,
      equipped: null,
      inventory: [],
      shopItems: [],
      isGenerating: false,
      isLoading: false,
      error: null,

      clearError: () => set({ error: null }),

      generateAvatar: async (voiceType: string | null) => {
        set({ isGenerating: true, error: null });
        try {
          const res = await fetch('/api/avatar/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voiceType }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            throw new Error(body.error ?? `서버 오류 (${res.status})`);
          }
          const data = await res.json() as AvatarData;
          set({ avatar: data, isGenerating: false });
        } catch (err) {
          const msg = err instanceof Error ? err.message : '아바타 생성에 실패했습니다.';
          set({ error: msg, isGenerating: false });
        }
      },

      fetchAvatar: async () => {
        set({ isLoading: true, error: null });
        try {
          const res = await fetch('/api/avatar/generate', { method: 'GET' });
          if (res.status === 404) {
            set({ avatar: null, isLoading: false });
            return;
          }
          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            throw new Error(body.error ?? `서버 오류 (${res.status})`);
          }
          const data = await res.json() as AvatarData;
          set({ avatar: data, isLoading: false });
        } catch (err) {
          const msg = err instanceof Error ? err.message : '아바타 로드에 실패했습니다.';
          set({ error: msg, isLoading: false });
        }
      },

      fetchInventory: async () => {
        try {
          const res = await fetch('/api/avatar/inventory', { method: 'GET' });
          if (!res.ok) return;
          const data = await res.json() as UserInventoryItem[];
          set({ inventory: data });
        } catch {
          // 무시 — 인벤토리 없어도 아바타 표시 가능
        }
      },

      fetchEquipped: async () => {
        try {
          const res = await fetch('/api/avatar/equip', { method: 'GET' });
          if (res.status === 404) {
            set({ equipped: null });
            return;
          }
          if (!res.ok) return;
          const data = await res.json() as UserEquipped;
          set({ equipped: data });
        } catch {
          // 무시
        }
      },

      fetchShopItems: async () => {
        try {
          const res = await fetch('/api/avatar/items', { method: 'GET' });
          if (!res.ok) return;
          const data = await res.json() as ShopItem[];
          set({ shopItems: data });
        } catch {
          // 무시
        }
      },

      equipItem: async (category: ItemCategory, itemId: string | null) => {
        set({ error: null });
        try {
          const res = await fetch('/api/avatar/equip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, itemId }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            throw new Error(body.error ?? `장착 실패 (${res.status})`);
          }
          const data = await res.json() as UserEquipped;
          set({ equipped: data });
        } catch (err) {
          const msg = err instanceof Error ? err.message : '장착 처리에 실패했습니다.';
          set({ error: msg });
        }
      },
    }),
    {
      name: 'vocalmind-avatar',
      partialize: (state) => ({
        avatar: state.avatar,
        equipped: state.equipped,
      }),
    },
  ),
);
