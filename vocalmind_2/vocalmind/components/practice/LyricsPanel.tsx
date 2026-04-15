'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import { saveAnalysis } from '@/lib/storage/songDB';
import type { LyricLine, SongAnalysis } from '@/types';
import PronunciationView from './PronunciationView';

interface Props {
  onSeek: (time: number) => void;
}

export default function LyricsPanel({ onSeek }: Props) {
  const {
    currentSongId,
    currentTime,
    isPlaying,
    currentAnalysis,
    setCurrentAnalysis,
    songs,
  } = usePracticeStore();

  const currentSong = useMemo(
    () => songs.find((s) => s.id === currentSongId) ?? null,
    [songs, currentSongId],
  );

  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [syncMode, setSyncMode] = useState(false);
  const [syncLineIndex, setSyncLineIndex] = useState(0);
  const [suggestedLyrics, setSuggestedLyrics] = useState<string | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  const lyrics: LyricLine[] = currentAnalysis?.lyrics ?? [];

  // Find active lyric line based on currentTime
  const activeLineIndex = useMemo(() => {
    if (lyrics.length === 0) return -1;
    let lastSynced = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].startTime !== null && lyrics[i].startTime! <= currentTime) {
        lastSynced = i;
      }
    }
    return lastSynced;
  }, [lyrics, currentTime]);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineIndex >= 0 && lineRefs.current[activeLineIndex] && scrollRef.current) {
      const line = lineRefs.current[activeLineIndex];
      if (line) {
        const container = scrollRef.current;
        const lineTop = line.offsetTop - container.offsetTop;
        const scrollTarget = lineTop - container.clientHeight / 3;
        container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
      }
    }
  }, [activeLineIndex]);

  // Handle line click -> seek
  const handleLineClick = useCallback((index: number) => {
    const line = lyrics[index];
    if (line && line.startTime !== null) {
      onSeek(line.startTime);
    }
  }, [lyrics, onSeek]);

  // Enter edit mode
  const handleEditStart = useCallback(() => {
    const text = lyrics.map((l) => l.text).join('\n');
    setEditText(text);
    setEditMode(true);
    setError(null);
  }, [lyrics]);

  // Save edited lyrics
  const handleEditSave = useCallback(async () => {
    if (!currentSongId || !currentAnalysis) return;

    const lines = editText.split('\n');
    const newLyrics: LyricLine[] = lines.map((text, i) => ({
      text,
      startTime: lyrics[i]?.startTime ?? null,
      pronunciation: lyrics[i]?.pronunciation,
    }));

    const updatedAnalysis: SongAnalysis = {
      ...currentAnalysis,
      lyrics: newLyrics,
    };

    try {
      await saveAnalysis(currentSongId, updatedAnalysis);
      setCurrentAnalysis(updatedAnalysis);
      setEditMode(false);
      setError(null);
    } catch {
      setError('가사 저장에 실패했습니다.');
    }
  }, [currentSongId, currentAnalysis, editText, lyrics, setCurrentAnalysis]);

  // Cancel edit
  const handleEditCancel = useCallback(() => {
    setEditMode(false);
    setEditText('');
    setError(null);
  }, []);

  // AI lyrics suggestion
  const handleAISuggest = useCallback(async () => {
    if (!currentSong) return;
    setLoadingSuggestion(true);
    setError(null);
    setSuggestedLyrics(null);

    try {
      const res = await fetch('/api/lyrics-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: currentSong.title,
          artist: currentSong.artist,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error ?? `요청 실패 (${res.status})`);
      }

      const data = await res.json();
      setSuggestedLyrics(data.suggestedLyrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 가사 제안에 실패했습니다.');
    } finally {
      setLoadingSuggestion(false);
    }
  }, [currentSong]);

  // Apply suggested lyrics
  const handleApplySuggestion = useCallback(async () => {
    if (!suggestedLyrics || !currentSongId) return;

    const lines = suggestedLyrics.split('\n');
    const newLyrics: LyricLine[] = lines.map((text) => ({
      text,
      startTime: null,
    }));

    const updatedAnalysis: SongAnalysis = currentAnalysis
      ? { ...currentAnalysis, lyrics: newLyrics }
      : {
          songId: currentSongId,
          melodyData: [],
          sections: [],
          vocalMap: [],
          songRange: { low: '', high: '' },
          lyrics: newLyrics,
          analyzedAt: new Date().toISOString(),
        };

    try {
      await saveAnalysis(currentSongId, updatedAnalysis);
      setCurrentAnalysis(updatedAnalysis);
      setSuggestedLyrics(null);
      setError(null);
    } catch {
      setError('가사 적용에 실패했습니다.');
    }
  }, [suggestedLyrics, currentSongId, currentAnalysis, setCurrentAnalysis]);

  // Sync mode: assign currentTime to current line
  const handleSyncTap = useCallback(async () => {
    if (!currentAnalysis || !currentSongId || syncLineIndex >= lyrics.length) return;

    const updatedLyrics = [...lyrics];
    updatedLyrics[syncLineIndex] = {
      ...updatedLyrics[syncLineIndex],
      startTime: currentTime,
    };

    const updatedAnalysis: SongAnalysis = {
      ...currentAnalysis,
      lyrics: updatedLyrics,
    };

    try {
      await saveAnalysis(currentSongId, updatedAnalysis);
      setCurrentAnalysis(updatedAnalysis);

      if (syncLineIndex < lyrics.length - 1) {
        setSyncLineIndex(syncLineIndex + 1);
      } else {
        setSyncMode(false);
        setSyncLineIndex(0);
      }
    } catch {
      setError('싱크 저장에 실패했습니다.');
    }
  }, [currentAnalysis, currentSongId, syncLineIndex, lyrics, currentTime, setCurrentAnalysis]);

  const handleSyncStart = useCallback(() => {
    setSyncMode(true);
    setSyncLineIndex(0);
    setError(null);
  }, []);

  const handleSyncStop = useCallback(() => {
    setSyncMode(false);
    setSyncLineIndex(0);
  }, []);

  // Handle pronunciation update from PronunciationView
  const handlePronunciationUpdate = useCallback(async (updatedLyrics: LyricLine[]) => {
    if (!currentSongId || !currentAnalysis) return;

    const updatedAnalysis: SongAnalysis = {
      ...currentAnalysis,
      lyrics: updatedLyrics,
    };

    try {
      await saveAnalysis(currentSongId, updatedAnalysis);
      setCurrentAnalysis(updatedAnalysis);
    } catch {
      setError('발음 저장에 실패했습니다.');
    }
  }, [currentSongId, currentAnalysis, setCurrentAnalysis]);

  // No song selected
  if (!currentSongId) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl px-5 py-4 flex flex-col gap-3">
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <div className="text-2xl opacity-[0.15]">&#9835;</div>
          <p className="text-sm text-[var(--text2)] leading-relaxed">곡을 선택해주세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-semibold text-[var(--text)]">가사</span>
        <div className="flex items-center gap-1.5">
          {lyrics.length > 0 && !editMode && !syncMode && (
            <>
              <button className="px-2.5 py-[5px] bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-xs cursor-pointer transition-all whitespace-nowrap hover:bg-[var(--surface2)] hover:text-[var(--text)]" onClick={handleEditStart}>
                가사 편집
              </button>
              {isPlaying && (
                <button className="px-2.5 py-[5px] bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-xs cursor-pointer transition-all whitespace-nowrap hover:bg-[var(--surface2)] hover:text-[var(--text)]" onClick={handleSyncStart}>
                  싱크
                </button>
              )}
            </>
          )}
          <button
            className={`${"px-2.5 py-[5px] bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-xs cursor-pointer transition-all whitespace-nowrap hover:bg-[var(--surface2)] hover:text-[var(--text)]"} ${loadingSuggestion ? "opacity-60 pointer-events-none" : ''}`}
            onClick={handleAISuggest}
            disabled={loadingSuggestion}
          >
            {loadingSuggestion ? '생성 중...' : 'AI 가사 제안'}
          </button>
          <PronunciationView
            lyrics={lyrics}
            currentSong={currentSong}
            onUpdate={handlePronunciationUpdate}
          />
        </div>
      </div>

      {error && <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-md text-xs text-[var(--error-lt)]">{error}</div>}

      {/* Sync mode bar */}
      {syncMode && lyrics.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-md">
          <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
          <span className="text-xs text-[var(--success-lt)] flex-1">
            싱크 모드 - 줄 {syncLineIndex + 1}/{lyrics.length}: &quot;{lyrics[syncLineIndex]?.text.slice(0, 30)}&quot;
          </span>
          <button className="px-3 py-1 bg-[var(--success)] border-none rounded-md text-white text-xs font-semibold cursor-pointer transition-colors hover:bg-[var(--success-lt)]" onClick={handleSyncTap}>
            싱크
          </button>
          <button className="px-3 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-xs cursor-pointer" onClick={handleSyncStop}>
            종료
          </button>
        </div>
      )}

      {/* AI Suggestion */}
      {suggestedLyrics && (
        <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--accent-lt)]">AI 가사 제안</span>
          </div>
          <div className="text-sm text-[var(--text2)] leading-[1.8] whitespace-pre-wrap max-h-[200px] overflow-y-auto">{suggestedLyrics}</div>
          <div className="flex gap-2 mt-2 justify-end">
            <button className="px-4 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-xs cursor-pointer transition-all hover:bg-[var(--surface2)] hover:text-[var(--text)]" onClick={() => setSuggestedLyrics(null)}>
              취소
            </button>
            <button className="px-4 py-1.5 bg-[var(--accent)] border-none rounded-md text-white text-xs font-semibold cursor-pointer transition-colors hover:bg-[var(--accent-lt)]" onClick={handleApplySuggestion}>
              적용
            </button>
          </div>
        </div>
      )}

      {/* Edit mode */}
      {editMode ? (
        <>
          <textarea
            className="w-full min-h-[200px] p-3 bg-[var(--bg3)] border border-[var(--border)] rounded-md text-[var(--text)] text-sm font-[Inter,Noto_Sans_KR,sans-serif] leading-[1.8] resize-y outline-none focus:border-[var(--accent)]"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="가사를 입력하세요 (줄바꿈으로 구분)"
          />
          <div className="flex gap-2 justify-end">
            <button className="px-4 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-xs cursor-pointer transition-all hover:bg-[var(--surface2)] hover:text-[var(--text)]" onClick={handleEditCancel}>
              취소
            </button>
            <button className="px-4 py-1.5 bg-[var(--accent)] border-none rounded-md text-white text-xs font-semibold cursor-pointer transition-colors hover:bg-[var(--accent-lt)]" onClick={handleEditSave}>
              저장
            </button>
          </div>
        </>
      ) : lyrics.length > 0 ? (
        /* Lyrics display */
        <div ref={scrollRef} className="max-h-[320px] overflow-y-auto scroll-smooth py-1">
          {lyrics.map((line, i) => (
            <div
              key={i}
              ref={(el) => { lineRefs.current[i] = el; }}
              className={`${"px-3 py-1.5 rounded-md cursor-pointer transition-all leading-relaxed hover:bg-[var(--surface)]"} ${
                syncMode && i === syncLineIndex
                  ? "bg-blue-500/[0.12] text-[var(--accent-lt)]"
                  : !syncMode && i === activeLineIndex
                    ? "bg-blue-500/[0.12] text-[var(--accent-lt)]"
                    : ''
              }`}
              onClick={() => handleLineClick(i)}
            >
              <span className="text-sm text-[var(--text)]">{line.text || '\u00A0'}</span>
              {line.startTime !== null && (
                <span className="text-[10px] text-[var(--muted)] font-[Inter,monospace] ml-2">
                  {Math.floor(line.startTime / 60)}:{Math.floor(line.startTime % 60).toString().padStart(2, '0')}
                </span>
              )}
              {line.pronunciation && (
                <div className="text-xs text-[var(--accent2-lt)] mt-0.5 opacity-80">{line.pronunciation}</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <div className="text-2xl opacity-[0.15]">&#128196;</div>
          <p className="text-sm text-[var(--text2)] leading-relaxed">
            가사를 입력하세요.
            <br />
            &quot;AI 가사 제안&quot; 버튼으로 자동 생성할 수도 있습니다.
          </p>
          <button className="px-2.5 py-[5px] bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-xs cursor-pointer transition-all whitespace-nowrap hover:bg-[var(--surface2)] hover:text-[var(--text)]" onClick={handleEditStart}>
            가사 입력
          </button>
        </div>
      )}
    </div>
  );
}
