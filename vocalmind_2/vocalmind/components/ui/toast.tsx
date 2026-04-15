'use client';

import { useToastStore, type ToastType } from '@/stores/toastStore';

const ICON: Record<ToastType, string> = {
  success: '\u2714',
  error: '\u2716',
  info: '\u2139',
};

const COLOR: Record<ToastType, { bg: string; border: string; text: string }> = {
  success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  error: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const c = COLOR[t.type];
        return (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border ${c.bg} ${c.border} backdrop-blur-md shadow-lg animate-[toastSlideIn_0.25s_ease-out]`}
          >
            <span className={`text-base ${c.text}`}>{ICON[t.type]}</span>
            <span className="text-sm text-white/90 font-medium">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="ml-2 text-white/40 hover:text-white/70 transition-colors bg-transparent border-none cursor-pointer text-xs"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
