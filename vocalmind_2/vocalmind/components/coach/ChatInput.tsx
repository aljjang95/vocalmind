'use client';

import { useRef, KeyboardEvent } from 'react';
import { IconSend } from '@/components/shared/Icons';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const text = inputRef.current?.value.trim();
    if (!text || disabled) return;
    inputRef.current!.value = '';
    onSend(text);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-[18px] py-3.5 border-t border-[var(--border)] flex gap-2.5 items-center bg-black/20">
      <input
        ref={inputRef}
        className="flex-1 px-4 py-[11px] bg-[var(--surface2)] border border-[var(--border)] rounded-[10px] text-[var(--text)] font-['Inter','Noto_Sans_KR',sans-serif] text-[0.875rem] outline-none transition-[border-color] duration-200 focus:border-[rgba(59,130,246,0.4)] placeholder:text-[var(--muted)] disabled:opacity-50 disabled:cursor-not-allowed"
        type="text"
        placeholder="보컬에 대해 무엇이든 물어보세요..."
        onKeyDown={handleKeyDown}
        disabled={disabled}
        maxLength={2000}
        aria-label="메시지 입력"
      />
      <button
        className="w-[42px] h-[42px] bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)] border-none rounded-[10px] cursor-pointer text-white text-[15px] flex items-center justify-center transition-[transform,box-shadow] duration-200 shadow-[0_4px_16px_rgba(59,130,246,0.3)] shrink-0 hover:enabled:scale-[1.07] hover:enabled:shadow-[0_6px_22px_rgba(59,130,246,0.45)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        onClick={handleSend}
        disabled={disabled}
        type="button"
        aria-label="전송"
      >
        <IconSend size={16} />
      </button>
    </div>
  );
}
