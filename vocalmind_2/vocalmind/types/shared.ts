// ─────────────────────────────────────────────
// 공유 타입 — 여러 도메인에서 공통으로 사용되는 기본 타입
// ─────────────────────────────────────────────

import type { Message } from './chat';

// ── API 응답 래퍼 ──
export interface ApiSuccess<T> {
  data: T;
  error?: never;
}

export interface ApiError {
  data?: never;
  error: string;
  code: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── 플랜 타입 ──
export type Plan = 'free' | 'hobby' | 'pro';

// ── 사용자 ──
export interface User {
  id: string;
  email: string;
  plan: Plan;
  createdAt: string;
}

// ── 대화 세션 ──
export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  messages?: Message[];
}
