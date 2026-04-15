'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useCoachingStore } from '@/stores/coachingStore';
import { getLessonById } from '@/lib/curriculum';
import ChatMessage, { TypingIndicator } from '@/components/coach/ChatMessage';
import ChatInput from '@/components/coach/ChatInput';
import { IconMic } from '@/components/shared/Icons';

export default function CoachingChat() {
  const {
    currentLessonId,
    messages,
    isLoading,
    append,
    setLoading,
    completeLesson,
  } = useCoachingStore();

  const bodyRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef<string>('');

  const lessonInfo = getLessonById(currentLessonId);

  // 레슨 변경 시 초기 메시지 삽입
  useEffect(() => {
    if (currentLessonId && currentLessonId !== initializedRef.current && messages.length === 0) {
      initializedRef.current = currentLessonId;
      if (lessonInfo) {
        const initMsg = `안녕하세요! 오늘은 **${lessonInfo.lesson.title}** 레슨을 진행할게요.\n\n${lessonInfo.lesson.description}\n\n준비가 되셨으면 질문을 해주시거나, "시작"이라고 말씀해주세요!`;
        append('assistant', initMsg);
      }
    }
  }, [currentLessonId, messages.length, lessonInfo, append]);

  // 스크롤 하단
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    if (trimmed.length > 2000) {
      append('assistant', '메시지가 너무 깁니다. 2,000자 이하로 입력해 주세요.');
      return;
    }

    const prevHistory = useCoachingStore
      .getState()
      .messages.map((m) => ({ role: m.role, content: m.content }));

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
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        if (res.status === 429) {
          append('assistant', '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.');
          return;
        }
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { reply?: string };
      append('assistant', data.reply ?? '죄송해요, 잠시 후 다시 시도해주세요.');

      const userMsgCount = useCoachingStore.getState().messages.filter((m) => m.role === 'user').length;
      if (userMsgCount >= 3 && currentLessonId) {
        completeLesson(currentLessonId);
      }
    } catch {
      append('assistant', '연결 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [isLoading, append, setLoading, completeLesson, currentLessonId]);

  return (
    <div className="bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r)] overflow-hidden flex flex-col max-h-[calc(100vh-120px)]">
      <div className="px-5 py-4 bg-black/30 border-b border-[var(--border)] flex items-center gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-[var(--accent)] to-[var(--success)] flex items-center justify-center text-[15px] shrink-0 text-white">
          <IconMic size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-['Inter',sans-serif] text-[0.88rem] font-bold whitespace-nowrap overflow-hidden text-ellipsis">
            {lessonInfo ? lessonInfo.lesson.title : 'HLB 보컬스튜디오 AI 코치'}
          </div>
          <div className="text-[0.7rem] text-[var(--text2)]">
            {lessonInfo ? `${lessonInfo.category.icon} ${lessonInfo.category.title}` : '레슨을 선택해주세요'}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-[5px] text-[0.7rem] text-[var(--success-lt)] font-mono shrink-0">
          <div className="w-[5px] h-[5px] bg-[var(--success-lt)] rounded-full animate-[pulse_2s_infinite]" />
          온라인
        </div>
      </div>

      <div
        className="flex-1 p-5 overflow-y-auto flex flex-col gap-3.5 min-h-[300px] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[var(--border2)] [&::-webkit-scrollbar-thumb]:rounded-sm"
        ref={bodyRef}
        role="log"
        aria-live="polite"
      >
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && <TypingIndicator />}
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center flex-1 text-[var(--text2)] text-[0.88rem] text-center p-10">
            <p>왼쪽 커리큘럼에서 레슨을 선택하면 코칭이 시작됩니다.</p>
          </div>
        )}
      </div>

      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
