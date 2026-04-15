'use client';

import { useTTS } from '@/lib/hooks/useTTS';

interface TTSButtonProps {
  text: string;
  size?: 'sm' | 'md';
  label?: string;
}

function SpeakerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

const sizeClasses = {
  sm: 'px-2 py-[3px] text-[0.7rem] rounded',
  md: 'px-3 py-1.5 text-[0.8rem] rounded-md',
} as const;

export default function TTSButton({ text, size = 'md', label = '듣기' }: TTSButtonProps) {
  const { play, isPlaying, isLoading } = useTTS(text);

  const displayLabel = isLoading ? '로딩' : isPlaying ? '정지' : label;

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 border-none cursor-pointer font-[inherit] whitespace-nowrap transition-[background,opacity] duration-150 text-[var(--accent-light)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 active:opacity-80 disabled:cursor-default disabled:opacity-50 border border-[var(--accent)]/20 ${sizeClasses[size]} ${isLoading ? 'opacity-60 cursor-wait' : ''} ${isPlaying ? 'shadow-[0_0_16px_var(--accent-glow)]' : ''}`}
      onClick={play}
      disabled={!text}
      aria-label={displayLabel}
    >
      <span className="inline-flex items-center shrink-0">
        {isLoading ? (
          <span className="w-3 h-3 border-2 border-white/15 border-t-[var(--accent-light)] rounded-full animate-spin" />
        ) : isPlaying ? (
          <StopIcon />
        ) : (
          <SpeakerIcon />
        )}
      </span>
      {displayLabel}
    </button>
  );
}
