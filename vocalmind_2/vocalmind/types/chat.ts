// ─────────────────────────────────────────────
// 채팅 타입 — 메시지, 채팅 API 요청/응답
// ─────────────────────────────────────────────

// ── 채팅 메시지 ──
export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

// ── 채팅 API 요청/응답 ──
// ChatRequest: Phase 2에서 /api/chat route.ts가 DB 신뢰 소스로 전환 시 재사용
export interface ChatRequest {
  messages: Array<{ role: MessageRole; content: string }>;
}

export interface ChatResponse {
  reply: string;
}
