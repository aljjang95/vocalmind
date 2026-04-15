'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
      aria-label="테마 변경"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-[var(--accent-light)]" />
      ) : (
        <Moon className="w-4 h-4 text-[var(--accent)]" />
      )}
    </button>
  );
}
