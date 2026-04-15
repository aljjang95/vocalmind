'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePracticeStore } from '@/stores/practiceStore';
import { getAnalysis } from '@/lib/storage/songDB';
import SongUploader from '@/components/practice/SongUploader';
import SongList from '@/components/practice/SongList';
import PracticePlayer from '@/components/practice/PracticePlayer';
import LoopControls from '@/components/practice/LoopControls';
import PitchDisplay from '@/components/practice/PitchDisplay';
import ModeSwitcher from '@/components/practice/ModeSwitcher';
import PlayMode from '@/components/practice/PlayMode';
import SessionResult from '@/components/practice/SessionResult';
import PitchTimeline from '@/components/practice/PitchTimeline';
import LyricsPanel from '@/components/practice/LyricsPanel';
import SectionTabs from '@/components/practice/SectionTabs';
import VocalMap from '@/components/practice/VocalMap';

export default function PracticePageClient() {
  const {
    songs,
    currentSongId,
    mode,
    showResult,
    currentSession,
    currentAnalysis,
    activePanel,
    setActivePanel,
    setCurrentAnalysis,
    setCurrentTime,
    setPlaying,
  } = usePracticeStore();

  const [uploaderCollapsed, setUploaderCollapsed] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const prevSongIdRef = useRef<string | null>(null);

  const currentSong = useMemo(
    () => songs.find((s) => s.id === currentSongId) ?? null,
    [songs, currentSongId],
  );

  // Load analysis cache when song changes
  useEffect(() => {
    if (!currentSongId || currentSongId === prevSongIdRef.current) return;
    prevSongIdRef.current = currentSongId;

    let cancelled = false;

    async function loadAnalysis() {
      if (!currentSongId) return;
      setAnalysisLoading(true);

      try {
        const cached = await getAnalysis(currentSongId);
        if (cancelled) return;

        if (cached) {
          setCurrentAnalysis(cached);
        } else {
          setCurrentAnalysis(null);
          // Auto-trigger analysis if song has melody data (future: auto-analyze)
          // For now, just clear
        }
      } catch {
        if (!cancelled) setCurrentAnalysis(null);
      } finally {
        if (!cancelled) setAnalysisLoading(false);
      }
    }

    loadAnalysis();

    return () => { cancelled = true; };
  }, [currentSongId, setCurrentAnalysis]);

  // Seek handler for LyricsPanel and SectionTabs
  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
    // Also dispatch a custom event for PracticePlayer to pick up the seek
    window.dispatchEvent(new CustomEvent('vocalmind-seek', { detail: { time } }));
  }, [setCurrentTime]);

  // Set default active panel when song is selected
  useEffect(() => {
    if (currentSongId && activePanel === null) {
      setActivePanel('pitch');
    }
  }, [currentSongId, activePanel, setActivePanel]);

  return (
    <>
      <div className="gradient-bg" aria-hidden="true" />
      <header className="sticky top-0 z-[100] py-4 bg-[var(--glass-bg)] backdrop-blur-[24px] backdrop-saturate-[180%] border-b border-[var(--border)]">
        <div className="container">
          <div className="flex items-center justify-between max-w-[1400px] mx-auto px-5">
            <Link href="/" className="font-[Inter] text-[1.1rem] font-bold text-[var(--text)] no-underline transition-colors hover:text-[var(--accent)]">
              &larr; HLB 보컬스튜디오
            </Link>
            <nav className="flex items-center gap-2">
              <Link href="/coach" className="px-[18px] py-2 text-[var(--text2)] no-underline text-[0.88rem] rounded-lg transition-all hover:text-[var(--text)] hover:bg-[var(--surface2)]">AI 코치</Link>
              <Link href="/diagnosis" className="px-[18px] py-2 text-[var(--text2)] no-underline text-[0.88rem] rounded-lg transition-all hover:text-[var(--text)] hover:bg-[var(--surface2)]">진단</Link>
              <Link href="/warmup" className="px-[18px] py-2 text-[var(--text2)] no-underline text-[0.88rem] rounded-lg transition-all hover:text-[var(--text)] hover:bg-[var(--surface2)]">워밍업</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="relative z-[1] py-5 pb-10">
        <div className="max-w-[1400px] mx-auto px-5">
          {/* Mode switcher at the top */}
          <div className="mb-4">
            <ModeSwitcher />
          </div>

          <div className="grid grid-cols-[280px_1fr] gap-5 min-h-[calc(100vh-180px)] max-[900px]:grid-cols-1">
            {/* Left sidebar: Song List */}
            <div className="flex flex-col min-h-0">
              <div className="flex-1 min-h-0 flex flex-col">
                <SongList />
              </div>
            </div>

            {/* Right content */}
            <div className="flex flex-col gap-4 min-h-0">
              {/* Uploader (collapsible) */}
              <SongUploader
                collapsed={uploaderCollapsed}
                onToggle={() => setUploaderCollapsed((prev) => !prev)}
              />

              {currentSong ? (
                <>
                  {mode === 'practice' ? (
                    <>
                      {/* Practice mode: Player + SectionTabs + Loop */}
                      <div className="flex flex-col gap-3">
                        <PracticePlayer song={currentSong} />
                        <SectionTabs onSeek={handleSeek} />
                        <LoopControls disabled={!currentSong} />
                      </div>

                      {/* Panel tabs */}
                      <div className="flex gap-1 bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-1">
                        <button
                          className={`${"flex-1 px-4 py-2 bg-transparent border-none rounded-md text-[var(--text2)] text-sm font-medium cursor-pointer transition-all hover:bg-[var(--surface)] hover:text-[var(--text)]"} ${activePanel === 'pitch' ? "bg-[var(--surface2)] text-[var(--accent-lt)] font-semibold hover:bg-[var(--surface2)]" : ''}`}
                          onClick={() => setActivePanel('pitch')}
                        >
                          피치
                        </button>
                        <button
                          className={`${"flex-1 px-4 py-2 bg-transparent border-none rounded-md text-[var(--text2)] text-sm font-medium cursor-pointer transition-all hover:bg-[var(--surface)] hover:text-[var(--text)]"} ${activePanel === 'lyrics' ? "bg-[var(--surface2)] text-[var(--accent-lt)] font-semibold hover:bg-[var(--surface2)]" : ''}`}
                          onClick={() => setActivePanel('lyrics')}
                        >
                          가사
                        </button>
                        <button
                          className={`${"flex-1 px-4 py-2 bg-transparent border-none rounded-md text-[var(--text2)] text-sm font-medium cursor-pointer transition-all hover:bg-[var(--surface)] hover:text-[var(--text)]"} ${activePanel === 'vocalmap' ? "bg-[var(--surface2)] text-[var(--accent-lt)] font-semibold hover:bg-[var(--surface2)]" : ''}`}
                          onClick={() => setActivePanel('vocalmap')}
                        >
                          보컬맵
                        </button>
                      </div>

                      {/* Active panel content */}
                      {activePanel === 'pitch' && <PitchDisplay />}
                      {activePanel === 'lyrics' && <LyricsPanel onSeek={handleSeek} />}
                      {activePanel === 'vocalmap' && (
                        <VocalMap onSeek={handleSeek} />
                      )}
                    </>
                  ) : (
                    <>
                      {/* Play mode */}
                      <PlayMode song={currentSong} />
                    </>
                  )}

                  {/* PitchTimeline: shown after play mode result */}
                  {showResult && currentSession && (
                    <PitchTimeline
                      session={currentSession}
                      analysis={currentAnalysis}
                    />
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center bg-[var(--bg2)] border border-[var(--border)] rounded-xl">
                  <div className="text-[3rem] opacity-[0.15]">&#9835;</div>
                  <h2 className="text-2xl font-bold text-[var(--text)]">곡을 선택해주세요</h2>
                  <p className="text-sm text-[var(--text2)] max-w-[360px] leading-relaxed">
                    좌측 목록에서 곡을 선택하거나, 위에서 새로운 곡을 업로드해주세요.
                    {mode === 'practice'
                      ? ' MR 재생, 보컬 가이드, 구간 반복, 실시간 음정 모니터링이 가능합니다.'
                      : ' Play 모드에서 전곡을 처음부터 끝까지 불러보세요.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Session result overlay */}
      {showResult && <SessionResult />}
    </>
  );
}
