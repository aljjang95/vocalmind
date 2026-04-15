'use client';

import { Message } from '@/types';
import { IconMic, IconUser } from '@/components/shared/Icons';
import TTSButton from '@/components/shared/TTSButton';

interface ChatMessageProps {
  message: Message;
}

// Safe text parser: converts newlines and **bold** patterns to React elements.
// No raw HTML injection -- XSS-safe by design.
function parseContent(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];

  text.split('\n').forEach((line, lineIdx) => {
    if (lineIdx > 0) nodes.push(<br key={`br-${lineIdx}-${text.slice(0, 8).replace(/\W/g, '')}`} />);

    // **bold** 처리
    const parts = line.split(/\*\*(.*?)\*\*/g);
    parts.forEach((part, partIdx) => {
      if (partIdx % 2 === 1) {
        nodes.push(<strong key={`b-${lineIdx}-${partIdx}-${part.slice(0,6).replace(/\W/g,"")}`}>{part}</strong>);
      } else if (part) {
        nodes.push(part);
      }
    });
  });

  return nodes;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2.5 items-end ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-[30px] h-[30px] rounded-lg shrink-0 flex items-center justify-center text-[13px] ${
          isUser
            ? 'bg-white/10 text-[var(--text2)]'
            : 'bg-[rgba(59,130,246,0.14)] text-[var(--accent-lt)]'
        }`}
      >
        {isUser ? <IconUser size={14} /> : <IconMic size={14} />}
      </div>
      <div
        className={`max-w-[78%] px-4 py-3 rounded-[18px] text-[0.875rem] leading-[1.58] ${
          isUser
            ? 'bg-white/[0.08] border border-white/[0.12] rounded-br-[5px] text-[var(--text)]'
            : 'bg-[rgba(59,130,246,0.11)] border border-[rgba(59,130,246,0.18)] rounded-bl-[5px] text-[var(--text2)]'
        }`}
      >
        {parseContent(message.content)}
        {!isUser && (
          <div className="mt-1.5 flex justify-end">
            <TTSButton text={message.content} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-2.5 items-end">
      <div className="w-[30px] h-[30px] rounded-lg shrink-0 flex items-center justify-center text-[13px] bg-[rgba(59,130,246,0.14)] text-[var(--accent-lt)]">
        <IconMic size={14} />
      </div>
      <div className="max-w-[78%] px-3.5 py-2 rounded-[18px] text-[0.875rem] leading-[1.58] bg-[rgba(59,130,246,0.11)] border border-[rgba(59,130,246,0.18)] rounded-bl-[5px] text-[var(--text2)]">
        <div className="flex gap-1 items-center py-1 px-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-[typingBounce_1.2s_infinite]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-[typingBounce_1.2s_infinite_0.2s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-[typingBounce_1.2s_infinite_0.4s]" />
        </div>
      </div>
    </div>
  );
}
