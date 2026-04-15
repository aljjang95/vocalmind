'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import ChatMessage, { TypingIndicator } from './ChatMessage';
import ChatInput from './ChatInput';
import QuickChips from './QuickChips';
import { IconMic } from '@/components/shared/Icons';

const INITIAL_MESSAGE = {
  id: 'init-0',
  role: 'assistant' as const,
  content: '안녕하세요! 저는 HLB 보컬스튜디오 AI 코치예요\n\n고음, 호흡, 발성, 오디션 준비 등 보컬에 관한 모든 것을 도와드릴게요. 무엇이든 편하게 물어보세요!',
  createdAt: new Date(),
};

export default function ChatBox() {
  const { messages, isLoading, append, setLoading } = useChatStore();
  const bodyRef = useRef<HTMLDivElement>(null);

  // 초기 메시지 1회 삽입
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current && messages.length === 0) {
      initialized.current = true;
      useChatStore.setState((s) => ({
        messages: s.messages.length === 0 ? [INITIAL_MESSAGE] : s.messages,
      }));
    }
  }, []); // 마운트 1회만 실행 — initialized.current 가드가 중복 삽입 방지

  // 새 메시지마다 스크롤 하단으로
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    // RISK-2: 클라이언트 길이 가드 (서버 MAX_CONTENT_LENGTH=2000과 동일)
    if (trimmed.length > 2000) {
      append('assistant', '메시지가 너무 깁니다. 2,000자 이하로 입력해 주세요.');
      return;
    }

    // append 전 현재 히스토리를 캡처 (초기 AI 메시지 제외)
    const prevHistory = useChatStore
      .getState()
      .messages.filter((m) => m.id !== 'init-0')
      .map((m) => ({ role: m.role, content: m.content }));

    // 새 user 메시지를 포함한 히스토리 구성
    const history = [...prevHistory, { role: 'user' as const, content: trimmed }];

    append('user', trimmed);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string; code?: string };
        // 429: rate limit — 별도 안내
        if (res.status === 429) {
          append('assistant', '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.');
          return;
        }
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { reply?: string };
      append('assistant', data.reply ?? '죄송해요, 잠시 후 다시 시도해주세요.');
    } catch {
      append('assistant', '연결 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reveal bg-[var(--bg3)] border border-[var(--border2)] rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.45)]">
      {/* Header */}
      <div className="px-[22px] py-[18px] bg-black/30 border-b border-[var(--border)] flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-[var(--accent)] to-[var(--success)] flex items-center justify-center text-[15px] shrink-0 text-white">
          <IconMic size={16} />
        </div>
        <div>
          <div className="font-['Inter',sans-serif] text-[0.9rem] font-bold">HLB 보컬스튜디오 AI 코치</div>
          <div className="text-[0.7rem] text-[var(--text2)]">7년 경력 보컬 트레이너 커리큘럼 탑재</div>
        </div>
        <div className="ml-auto flex items-center gap-[5px] text-[0.7rem] text-[var(--success-lt)] font-mono">
          <div className="w-[5px] h-[5px] bg-[var(--success-lt)] rounded-full animate-[pulse_2s_infinite]" />
          온라인
        </div>
      </div>

      {/* Message body */}
      <div
        className="p-5 min-h-[320px] max-h-[380px] overflow-y-auto flex flex-col gap-3.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[var(--border2)] [&::-webkit-scrollbar-thumb]:rounded-sm"
        ref={bodyRef}
        role="log"
        aria-live="polite"
      >
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
      </div>

      {/* Quick chips */}
      <QuickChips onSelect={sendMessage} disabled={isLoading} />

      {/* Input bar */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
