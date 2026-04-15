'use client';

import { create } from 'zustand';
import type { CommunityPost, FeedTab } from '@/types';

interface CommunityState {
  posts: CommunityPost[];
  tab: FeedTab;
  cursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;

  setTab: (tab: FeedTab) => void;
  fetchPosts: (reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  createPost: (data: FormData) => Promise<void>;
  votePost: (postId: string) => Promise<void>;
  unvotePost: (postId: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  posts: [],
  tab: 'latest',
  cursor: null,
  hasMore: true,
  isLoading: false,
  error: null,

  setTab: (tab) => {
    set({ tab, posts: [], cursor: null, hasMore: true, error: null });
    get().fetchPosts(true);
  },

  fetchPosts: async (reset = false) => {
    const { tab, cursor, isLoading } = get();
    if (isLoading) return;

    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams({ tab });
      if (!reset && cursor) params.set('cursor', cursor);

      const res = await fetch(`/api/community?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as {
        posts: CommunityPost[];
        cursor: string | null;
        hasMore: boolean;
      };

      set((state) => ({
        posts: reset ? data.posts : [...state.posts, ...data.posts],
        cursor: data.cursor,
        hasMore: data.hasMore,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '게시글을 불러오지 못했습니다.' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadMore: async () => {
    const { hasMore, isLoading } = get();
    if (!hasMore || isLoading) return;
    await get().fetchPosts(false);
  },

  createPost: async (formData) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { post: CommunityPost };
      // 새 글을 최신 탭이면 맨 앞에 삽입
      set((state) => ({
        posts: state.tab === 'latest' || state.tab === 'battle'
          ? [data.post, ...state.posts]
          : state.posts,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '게시글 작성에 실패했습니다.' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  votePost: async (postId) => {
    // 낙관적 업데이트
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === postId
          ? { ...p, vote_count: p.vote_count + 1, has_voted: true }
          : p,
      ),
    }));

    try {
      const res = await fetch('/api/community/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        // 롤백
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id === postId
              ? { ...p, vote_count: p.vote_count - 1, has_voted: false }
              : p,
          ),
        }));
      }
    } catch {
      // 롤백
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId
            ? { ...p, vote_count: p.vote_count - 1, has_voted: false }
            : p,
        ),
      }));
    }
  },

  unvotePost: async (postId) => {
    // 낙관적 업데이트
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === postId
          ? { ...p, vote_count: Math.max(0, p.vote_count - 1), has_voted: false }
          : p,
      ),
    }));

    try {
      const res = await fetch('/api/community/vote', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      if (!res.ok) {
        // 롤백
        set((state) => ({
          posts: state.posts.map((p) =>
            p.id === postId
              ? { ...p, vote_count: p.vote_count + 1, has_voted: true }
              : p,
          ),
        }));
      }
    } catch {
      // 롤백
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId
            ? { ...p, vote_count: p.vote_count + 1, has_voted: true }
            : p,
        ),
      }));
    }
  },

  deletePost: async (postId) => {
    try {
      const res = await fetch(`/api/community/${postId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      set((state) => ({
        posts: state.posts.filter((p) => p.id !== postId),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : '삭제에 실패했습니다.' });
      throw err;
    }
  },
}));
