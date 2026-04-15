'use client';

import { useState, useCallback } from 'react';
import type { LyricLine, Song } from '@/types';

type Language = 'en' | 'ja' | 'zh' | 'es';

const LANG_OPTIONS: { value: Language; label: string }[] = [
  { value: 'en', label: '영어' },
  { value: 'ja', label: '일본어' },
  { value: 'zh', label: '중국어' },
  { value: 'es', label: '스페인어' },
];

interface Props {
  lyrics: LyricLine[];
  currentSong: Song | null;
  onUpdate: (updatedLyrics: LyricLine[]) => void;
}

export default function PronunciationView({ lyrics, currentSong, onUpdate }: Props) {
  const [showPronunciation, setShowPronunciation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [error, setError] = useState<string | null>(null);

  const hasPronunciation = lyrics.some((l) => l.pronunciation);

  const handleToggle = useCallback(() => {
    if (!showPronunciation && !hasPronunciation && lyrics.length > 0) {
      // Auto-generate if no pronunciations exist
      handleGenerate();
    }
    setShowPronunciation((prev) => !prev);
  }, [showPronunciation, hasPronunciation, lyrics.length]);

  const handleGenerate = useCallback(async () => {
    if (!currentSong || lyrics.length === 0) return;

    const lyricsText = lyrics.map((l) => l.text).filter((t) => t.trim()).join('\n');
    if (!lyricsText.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/pronunciation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyrics: lyricsText,
          language,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? `요청 실패 (${res.status})`);
      }

      const data = await res.json();

      // Map pronunciations back to lyrics
      const nonEmptyLines = lyrics.filter((l) => l.text.trim());
      const updatedLyrics = lyrics.map((line) => {
        if (!line.text.trim()) return line;
        const nonEmptyIdx = nonEmptyLines.indexOf(line);
        const pronLine = data.lines[nonEmptyIdx];
        return {
          ...line,
          pronunciation: pronLine?.korean ?? line.pronunciation,
        };
      });

      onUpdate(updatedLyrics);
      setShowPronunciation(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '발음 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [currentSong, lyrics, language, onUpdate]);

  return (
    <>
      <select
        className="px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-xs cursor-pointer outline-none focus:border-[var(--accent)]"
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
      >
        {LANG_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <button
        className={`px-2.5 py-[5px] border rounded-md text-xs cursor-pointer transition-all whitespace-nowrap ${
          showPronunciation
            ? 'bg-purple-500/[0.15] border-[var(--accent2)] text-[var(--accent2-lt)] hover:bg-purple-500/20'
            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text2)] hover:bg-[var(--surface2)] hover:text-[var(--text)]'
        } ${loading ? 'opacity-60 pointer-events-none' : ''}`}
        onClick={handleToggle}
        disabled={loading}
      >
        {loading ? '생성 중...' : showPronunciation ? '발음 숨기기' : '발음 보기'}
      </button>

      {hasPronunciation && !showPronunciation && (
        <button
          className={`px-2.5 py-[5px] bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-xs cursor-pointer transition-all whitespace-nowrap hover:bg-[var(--surface2)] hover:text-[var(--text)] ${loading ? 'opacity-60 pointer-events-none' : ''}`}
          onClick={handleGenerate}
          disabled={loading || lyrics.length === 0}
        >
          발음 재생성
        </button>
      )}

      {error && (
        <span className="text-xs text-[var(--error-lt)]">{error}</span>
      )}
    </>
  );
}
