'use client';

import { useEffect, useRef, useState } from 'react';

type ToastType = 'positive' | 'neutral' | 'correction';

interface Props {
  message: string | null;
  type: ToastType;
}

const AUTO_DISMISS_MS = 3000;
const EXIT_ANIMATION_MS = 300;

const TYPE_CLASSES: Record<ToastType, string> = {
  positive: 'bg-emerald-500/[0.15] border border-emerald-500/30 text-emerald-300',
  neutral: 'bg-[var(--bg-hover)]/[0.15] border border-[var(--text-muted)]/30 text-[var(--text-secondary)]',
  correction: 'bg-orange-400/[0.15] border border-orange-400/30 text-orange-300',
};

export default function LiveFeedbackToast({ message, type }: Props) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [displayMessage, setDisplayMessage] = useState<string | null>(null);
  const [displayType, setDisplayType] = useState<ToastType>('neutral');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;

    // Clear any pending dismiss
    if (timerRef.current) clearTimeout(timerRef.current);

    setDisplayMessage(message);
    setDisplayType(type);
    setExiting(false);
    setVisible(true);

    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => {
        setVisible(false);
        setExiting(false);
      }, EXIT_ANIMATION_MS);
    }, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [message, type]);

  if (!visible || !displayMessage) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
      <div
        className={`px-5 py-2.5 rounded-xl text-[13px] font-medium leading-snug max-w-[340px] text-center pointer-events-auto bg-[var(--bg-elevated)] border border-white/[0.06] shadow-lg ${TYPE_CLASSES[displayType]}`}
        style={{
          animation: exiting
            ? 'toastSlideOut 0.3s ease forwards'
            : 'toastSlideIn 0.3s ease forwards',
        }}
      >
        {displayMessage}
      </div>
    </div>
  );
}
