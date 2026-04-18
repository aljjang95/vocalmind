'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import { getBlob, saveSession } from '@/lib/storage/songDB';
import { getAudioContext, resumeAudioContext } from '@/lib/audio/audioEngine';
import {
  startPitchDetection,
  stopPitchDetection,
  isPitchDetectionActive,
} from '@/lib/audio/pitchDetector';
import type { PitchData } from '@/lib/audio/pitchDetector';
import type { Song, MelodyPoint, SessionScore } from '@/types';
import { useRhythmDetection } from '@/lib/hooks/useRhythmDetection';
import { loadBeatGrid } from '@/lib/audio/beatGridLoader';

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  song: Song;
}

export default function PlayMode({ song }: Props) {
  const {
    isPlaying,
    isRecording,
    currentTime,
    duration,
    mrVolume,
    playbackRate,
    startPlay,
    endPlay,
    setCurrentTime,
    setDuration,
    setCurrentSession,
    setShowResult,
    rhythmEnabled,
    outputLatencyMs,
    currentAnalysis,
    setRhythmLive,
    setRhythmSession,
  } = usePracticeStore();

  const [phase, setPhase] = useState<'ready' | 'playing' | 'scoring'>('ready');
  const [currentNote, setCurrentNote] = useState<string>('--');
  const [currentFreq, setCurrentFreq] = useState<number>(0);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  // F2: 리듬 세션 훅 — 서버 WebSocket 스트리밍
  const {
    lastClassification,
    sessionScore: rhythmHookSession,
    startSession: startRhythmSession,
    stopSession: stopRhythmSession,
  } = useRhythmDetection();

  // Audio refs
  const mrBufferRef = useRef<AudioBuffer | null>(null);
  const mrSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const mrGainRef = useRef<GainNode | null>(null);
  const playStartTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number>(0);
  const pitchDataRef = useRef<MelodyPoint[]>([]);
  const loadedIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef(false);

  // Load MR buffer
  useEffect(() => {
    if (!song || loadedIdRef.current === song.id) return;
    let cancelled = false;

    async function load() {
      if (!song) return;
      const ctx = getAudioContext();
      const blob = await getBlob(song.instrumentalBlobKey);
      if (!blob || cancelled) return;

      const arrayBuffer = await blob.arrayBuffer();
      if (cancelled) return;
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      if (cancelled) return;

      mrBufferRef.current = audioBuffer;
      setDuration(audioBuffer.duration);
      loadedIdRef.current = song.id;
    }

    load();
    return () => { cancelled = true; };
  }, [song, setDuration]);

  // Initialize gain node
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ctx = getAudioContext();
    if (!mrGainRef.current) {
      mrGainRef.current = ctx.createGain();
      mrGainRef.current.connect(ctx.destination);
    }

    return () => {
      stopAllAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync MR volume
  useEffect(() => {
    if (mrGainRef.current) {
      mrGainRef.current.gain.value = mrVolume;
    }
  }, [mrVolume]);

  const stopAllAudio = useCallback(() => {
    try {
      if (mrSourceRef.current) {
        mrSourceRef.current.onended = null;
        mrSourceRef.current.stop();
        mrSourceRef.current.disconnect();
      }
    } catch { /* already stopped */ }
    mrSourceRef.current = null;

    if (isPitchDetectionActive()) {
      stopPitchDetection();
    }

    cancelAnimationFrame(animFrameRef.current);
    isPlayingRef.current = false;
  }, []);

  const onPitch = useCallback((data: PitchData) => {
    setCurrentNote(data.noteName);
    setCurrentFreq(data.frequency);

    pitchDataRef.current.push({
      time: usePracticeStore.getState().currentTime,
      frequency: data.frequency,
      noteName: data.noteName,
    });
  }, []);

  const calculateScore = useCallback((): number => {
    const points = pitchDataRef.current;
    if (points.length === 0) return 0;

    // Simple scoring: percentage of detected points with reasonable frequency
    const validPoints = points.filter((p) => p.frequency > 80 && p.frequency < 1200);
    const coverage = Math.min(1, validPoints.length / Math.max(1, duration * 2));

    // Basic consistency score: check if frequencies don't jump wildly
    let consistencyScore = 1;
    if (validPoints.length > 1) {
      let jumpCount = 0;
      for (let i = 1; i < validPoints.length; i++) {
        const ratio = validPoints[i].frequency / validPoints[i - 1].frequency;
        if (ratio > 2 || ratio < 0.5) jumpCount++;
      }
      consistencyScore = 1 - (jumpCount / validPoints.length);
    }

    // Combine: coverage * 40 + consistency * 60
    const raw = (coverage * 40 + consistencyScore * 60);
    return Math.round(Math.max(0, Math.min(100, raw)));
  }, [duration]);

  const finishPlay = useCallback(async (partial: boolean) => {
    stopAllAudio();
    // F2: 리듬 세션이 활성화되어 있으면 stopSession → 서버가 report 송신
    if (rhythmEnabled && song.beatGridUrl) {
      stopRhythmSession();
    }
    endPlay();
    setPhase('scoring');

    const score = calculateScore();
    const actualDuration = usePracticeStore.getState().currentTime;

    const session: SessionScore = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      songId: song.id,
      playedAt: new Date().toISOString(),
      keyShift: usePracticeStore.getState().keyShift,
      overallScore: score,
      sectionScores: [],
      userPitchData: pitchDataRef.current,
      duration: partial ? actualDuration : duration,
    };

    try {
      await saveSession(session);
    } catch {
      // Session save failure is non-critical
    }

    setCurrentSession(session);
    setShowResult(true);
    setPhase('ready');
    pitchDataRef.current = [];
    setCurrentNote('--');
    setCurrentFreq(0);
  }, [stopAllAudio, endPlay, calculateScore, song.id, song.beatGridUrl, duration, setCurrentSession, setShowResult, rhythmEnabled, stopRhythmSession]);

  const handleStart = useCallback(async () => {
    if (!mrBufferRef.current || !mrGainRef.current) return;

    const ctx = getAudioContext();
    await resumeAudioContext();

    pitchDataRef.current = [];
    setPhase('playing');

    // Create and start MR source
    const source = ctx.createBufferSource();
    source.buffer = mrBufferRef.current;
    source.playbackRate.value = playbackRate;
    source.connect(mrGainRef.current);

    source.onended = () => {
      if (isPlayingRef.current) {
        finishPlay(false);
      }
    };

    source.start(0);
    mrSourceRef.current = source;
    playStartTimeRef.current = ctx.currentTime;
    isPlayingRef.current = true;
    startPlay();

    // F2: 리듬 세션 시작 — beatGridUrl 있고 토글 ON일 때만
    if (rhythmEnabled && song.beatGridUrl) {
      try {
        const grid = await loadBeatGrid(song.beatGridUrl);
        if (grid) {
          const sections = (currentAnalysis?.sections ?? []).map((s) => ({
            start_sec: s.startTime,
            end_sec: s.endTime,
            label: s.label,
          }));
          await startRhythmSession({
            beatGrid: grid,
            outputLatencyMs,
            sections,
          });
        }
      } catch {
        // 리듬 세션 실패는 비치명적 — Play 모드는 계속 진행
      }
    }

    // Start pitch detection
    try {
      await startPitchDetection(onPitch);
    } catch {
      // Pitch detection failure is non-critical, continue without it
    }

    // Time update loop
    function tick() {
      if (!isPlayingRef.current) return;
      const ctx = getAudioContext();
      const elapsed = (ctx.currentTime - playStartTimeRef.current) * playbackRate;
      setCurrentTime(elapsed);
      animFrameRef.current = requestAnimationFrame(tick);
    }
    animFrameRef.current = requestAnimationFrame(tick);
  }, [playbackRate, startPlay, onPitch, setCurrentTime, finishPlay, rhythmEnabled, song.beatGridUrl, outputLatencyMs, currentAnalysis, startRhythmSession]);

  // F2: 훅 상태 → 스토어 반영 (실시간 배지 + 세션 결과)
  useEffect(() => {
    if (lastClassification) {
      setRhythmLive({ lastClassification, updatedAt: Date.now() });
    }
  }, [lastClassification, setRhythmLive]);

  useEffect(() => {
    if (rhythmHookSession) {
      setRhythmSession(rhythmHookSession);
    }
  }, [rhythmHookSession, setRhythmSession]);

  const handleStopRequest = useCallback(() => {
    setShowStopConfirm(true);
  }, []);

  const handleStopConfirm = useCallback(() => {
    setShowStopConfirm(false);
    finishPlay(true);
  }, [finishPlay]);

  const handleStopCancel = useCallback(() => {
    setShowStopConfirm(false);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, [stopAllAudio]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const separationStatus = song.separationStatus ?? 'done';

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 flex flex-col gap-5">
      {/* Song header */}
      <div className="text-center">
        <div className="text-2xl font-bold text-[var(--text)]">{song.title}</div>
        <div className="text-sm text-[var(--text2)] mt-1">{song.artist}</div>
      </div>

      {separationStatus === 'pending' && (
        <div className="text-center px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-[var(--warning)] text-xs">
          보컬 분리 진행 중입니다. 원본 파일로 MR이 재생됩니다.
        </div>
      )}

      {/* Pitch display */}
      <div className="flex flex-col items-center justify-center px-5 py-10 bg-[var(--bg3)] rounded-lg min-h-[160px]">
        <div className="text-[4rem] font-extrabold text-[var(--accent-lt)] font-[Inter,monospace] leading-none">{currentNote}</div>
        {currentFreq > 0 && (
          <div className="text-sm text-[var(--muted)] mt-2">{currentFreq.toFixed(1)} Hz</div>
        )}
      </div>

      {/* Progress */}
      {phase === 'playing' && (
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 bg-[var(--surface2)] rounded-sm overflow-hidden">
            <div className="h-full bg-[var(--accent)] rounded-sm transition-[width] duration-150" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          <div className="flex justify-between text-xs text-[var(--muted)]">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-center">
        {phase === 'ready' && (
          <button
            className="px-12 py-3.5 bg-[var(--accent)] text-white border-none rounded-lg text-base font-bold cursor-pointer transition-all hover:opacity-90 hover:-translate-y-px disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleStart}
            disabled={!mrBufferRef.current}
          >
            시작
          </button>
        )}

        {phase === 'playing' && (
          <button
            className="px-8 py-3 bg-transparent text-[var(--error-lt)] border border-[var(--error)] rounded-lg text-sm font-semibold cursor-pointer transition-colors hover:bg-red-500/10"
            onClick={handleStopRequest}
          >
            중간에 그만두기
          </button>
        )}

        {phase === 'scoring' && (
          <div className="text-sm text-[var(--accent-lt)] font-semibold animate-pulse">
            채점 중...
          </div>
        )}
      </div>

      {/* Stop confirmation */}
      {showStopConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]" onClick={handleStopCancel}>
          <div className="bg-[var(--bg2)] border border-[var(--border2)] rounded-xl p-7 max-w-[360px] w-[90%] text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-semibold text-[var(--text)] mb-6">
              여기까지 채점할까요?
            </p>
            <div className="flex gap-2.5 justify-center">
              <button className="px-5 py-2.5 bg-[var(--surface2)] text-[var(--text2)] border border-[var(--border)] rounded-md text-sm cursor-pointer transition-colors hover:bg-[var(--surface3)]" onClick={handleStopCancel}>
                계속 부르기
              </button>
              <button className="px-5 py-2.5 bg-[var(--accent)] text-white border-none rounded-md text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90" onClick={handleStopConfirm}>
                채점하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
