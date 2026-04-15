'use client';

import { create } from 'zustand';
import { Message, MessageRole } from '@/types';

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  append: (role: MessageRole, content: string) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,

  append: (role, content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role,
          content,
          createdAt: new Date(),
        },
      ],
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  reset: () => set({ messages: [], isLoading: false }),
}));
