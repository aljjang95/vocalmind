import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Song, PracticeMode, SessionScore, SongAnalysis } from '@/types';

interface PracticeState {
  // ── 곡 관리 (기존 유지) ──
  songs: Song[];
  currentSongId: string | null;

  // ── 모드 (신규) ──
  mode: PracticeMode;

  // ── 재생 제어 (기존 확장) ──
  isPlaying: boolean;
  playbackRate: number;
  currentTime: number;
  duration: number;
  mrVolume: number;
  vocalGuideVolume: number;
  keyShift: number;

  // ── Practice 모드 (기존) ──
  loopStart: number | null;
  loopEnd: number | null;

  // ── Play 모드 (신규) ──
  isRecording: boolean;
  currentSession: SessionScore | null;

  // ── UI (신규) ──
  activePanel: 'lyrics' | 'pitch' | 'vocalmap' | null;
  showResult: boolean;

  // ── 분석 캐시 (신규) ──
  currentAnalysis: SongAnalysis | null;

  // ── 액션: 기존 ──
  addSong: (song: Song) => void;
  removeSong: (id: string) => void;
  updateSong: (id: string, updates: Partial<Song>) => void;
  setCurrentSong: (id: string | null) => void;
  setPlaying: (v: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setLoop: (start: number, end: number) => void;
  clearLoop: () => void;
  setMrVolume: (v: number) => void;
  setVocalGuideVolume: (v: number) => void;
  setCurrentTime: (t: number) => void;

  // ── 액션: 신규 ──
  setMode: (mode: PracticeMode) => void;
  setKeyShift: (shift: number) => void;
  setDuration: (d: number) => void;
  setIsRecording: (v: boolean) => void;
  setCurrentSession: (session: SessionScore | null) => void;
  setActivePanel: (panel: 'lyrics' | 'pitch' | 'vocalmap' | null) => void;
  setShowResult: (v: boolean) => void;
  setCurrentAnalysis: (analysis: SongAnalysis | null) => void;
  startPlay: () => void;
  endPlay: () => void;
}

export const usePracticeStore = create<PracticeState>()(
  persist(
    (set) => ({
      // ── 초기 상태: 기존 ──
      songs: [],
      currentSongId: null,
      isPlaying: false,
      playbackRate: 1.0,
      currentTime: 0,
      duration: 0,
      mrVolume: 0.8,
      vocalGuideVolume: 0.3,
      loopStart: null,
      loopEnd: null,

      // ── 초기 상태: 신규 ──
      mode: 'practice' as PracticeMode,
      keyShift: 0,
      isRecording: false,
      currentSession: null,
      activePanel: null,
      showResult: false,
      currentAnalysis: null,

      // ── 액션: 기존 ──
      addSong: (song) =>
        set((s) => ({ songs: [...s.songs, song] })),
      removeSong: (id) =>
        set((s) => ({
          songs: s.songs.filter((song) => song.id !== id),
          currentSongId: s.currentSongId === id ? null : s.currentSongId,
        })),
      updateSong: (id, updates) =>
        set((s) => ({
          songs: s.songs.map((song) =>
            song.id === id ? { ...song, ...updates } : song
          ),
        })),
      setCurrentSong: (id) =>
        set({
          currentSongId: id,
          currentTime: 0,
          isPlaying: false,
          currentSession: null,
          showResult: false,
          isRecording: false,
        }),
      setPlaying: (v) => set({ isPlaying: v }),
      setPlaybackRate: (rate) => set({ playbackRate: rate }),
      setLoop: (start, end) => set({ loopStart: start, loopEnd: end }),
      clearLoop: () => set({ loopStart: null, loopEnd: null }),
      setMrVolume: (v) => set({ mrVolume: v }),
      setVocalGuideVolume: (v) => set({ vocalGuideVolume: v }),
      setCurrentTime: (t) => set({ currentTime: t }),

      // ── 액션: 신규 ──
      setMode: (mode) =>
        set({
          mode,
          isPlaying: false,
          isRecording: false,
          currentSession: null,
          showResult: false,
          loopStart: null,
          loopEnd: null,
        }),
      setKeyShift: (shift) =>
        set({ keyShift: Math.max(-6, Math.min(6, shift)) }),
      setDuration: (d) => set({ duration: d }),
      setIsRecording: (v) => set({ isRecording: v }),
      setCurrentSession: (session) => set({ currentSession: session }),
      setActivePanel: (panel) => set({ activePanel: panel }),
      setShowResult: (v) => set({ showResult: v }),
      setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),
      startPlay: () =>
        set({
          isPlaying: true,
          isRecording: true,
          currentTime: 0,
          showResult: false,
          currentSession: null,
        }),
      endPlay: () =>
        set({
          isPlaying: false,
          isRecording: false,
        }),
    }),
    {
      name: 'vocalmind-practice',
      partialize: (state) => ({
        songs: state.songs,
        playbackRate: state.playbackRate,
        mrVolume: state.mrVolume,
        vocalGuideVolume: state.vocalGuideVolume,
        keyShift: state.keyShift,
        mode: state.mode,
      }),
    }
  )
);
