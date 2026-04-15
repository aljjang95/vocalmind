'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useScalePracticeStore } from '@/stores/scalePracticeStore';
import { Note } from 'tonal';
import SoundfontProvider from './SoundfontProvider';

// react-piano: 동적 import (SSR 미지원)
let RP: typeof import('react-piano') | null = null;

const SOLFEGE: Record<string, string> = {
  C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시',
};

function midiLabel(midi: number, mode: 'solfege' | 'note' | 'number'): string {
  const name = Note.fromMidi(midi);
  if (mode === 'number') return String(midi);
  if (mode === 'note') return name;
  const letter = name.replace(/[0-9#b]/g, '');
  const acc = name.includes('#') ? '#' : '';
  return (SOLFEGE[letter] || letter) + acc;
}

function hzToMidi(hz: number): number {
  return Math.round(69 + 12 * Math.log2(hz / 440));
}

export default function PianoKeyboard() {
  const [loaded, setLoaded] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const { currentNote, detectedPitch, keyLabel, startNote } = useScalePracticeStore();
  const playNoteRef = useRef<((midi: number) => void) | null>(null);
  const stopNoteRef = useRef<((midi: number) => void) | null>(null);
  const prevNoteRef = useRef<number | null>(null);

  const baseMidi = Note.midi(startNote) ?? 48;
  const firstNote = Math.max(baseMidi - 5, 21);
  const lastNote = Math.min(baseMidi + 20, 108);

  // AudioContext 생성 (한 번만)
  useEffect(() => {
    audioCtxRef.current = new AudioContext();
    return () => { audioCtxRef.current?.close(); };
  }, []);

  // react-piano 동적 로드
  useEffect(() => {
    Promise.all([
      import('react-piano'),
      import('react-piano/dist/styles.css'),
    ]).then(([mod]) => {
      RP = mod;
      setLoaded(true);
    });
  }, []);

  // currentNote 변화 → 소리 자동 재생
  useEffect(() => {
    if (prevNoteRef.current && prevNoteRef.current !== currentNote) {
      stopNoteRef.current?.(prevNoteRef.current);
    }
    if (currentNote) {
      playNoteRef.current?.(currentNote);
    }
    prevNoteRef.current = currentNote;
  }, [currentNote]);

  const activeNotes = useMemo(() => {
    const notes: number[] = [];
    if (currentNote) notes.push(currentNote);
    if (detectedPitch) {
      const dm = hzToMidi(detectedPitch);
      if (dm >= firstNote && dm <= lastNote && dm !== currentNote) notes.push(dm);
    }
    return notes;
  }, [currentNote, detectedPitch, firstNote, lastNote]);

  const renderNoteLabel = useCallback(({ midiNumber, isAccidental }: { midiNumber: number; isActive: boolean; isAccidental: boolean }) => {
    const isCurrent = currentNote === midiNumber;
    const isDetected = detectedPitch ? hzToMidi(detectedPitch) === midiNumber : false;
    return (
      <div style={{
        fontSize: isAccidental ? 8 : 10, fontWeight: 600,
        color: isCurrent ? 'var(--streak-gold)' : isDetected ? 'var(--success)' : isAccidental ? 'rgba(255,255,255,0.4)' : 'var(--text-muted)',
        userSelect: 'none', textAlign: 'center',
      }}>
        {midiLabel(midiNumber, keyLabel)}
      </div>
    );
  }, [keyLabel, currentNote, detectedPitch]);

  if (!loaded || !RP || !audioCtxRef.current) {
    return (
      <div style={{
        height: 200, borderRadius: 16,
        background: 'linear-gradient(180deg, #18182a, #0e0e1a)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: 14, fontFamily: "'Pretendard', sans-serif",
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        🎹 피아노 로딩 중...
      </div>
    );
  }

  const { Piano, MidiNumbers } = RP;
  const first = MidiNumbers.fromNote(Note.fromMidi(firstNote));
  const last = MidiNumbers.fromNote(Note.fromMidi(lastNote));

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden',
      background: 'linear-gradient(180deg, #1e1e32 0%, #12121f 100%)',
      padding: '14px 10px 18px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.05)',
    }}>
      {/* 상단 목재 트림 */}
      <div style={{
        height: 5, borderRadius: 3, marginBottom: 10,
        background: 'linear-gradient(90deg, #5c3a1e, #a0642c, #5c3a1e)',
        opacity: 0.55,
      }} />

      {/* 현재 상태 표시 */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 10,
        fontSize: 13, fontFamily: "'Pretendard', sans-serif",
      }}>
        {currentNote && (
          <span style={{ color: 'var(--streak-gold)', fontWeight: 700, textShadow: '0 0 10px rgba(251,191,36,0.35)' }}>
            🎹 {Note.fromMidi(currentNote)}
          </span>
        )}
        {detectedPitch && (
          <span style={{ color: 'var(--success)', fontWeight: 600 }}>
            🎤 {Math.round(detectedPitch)}Hz
          </span>
        )}
      </div>

      {/* react-piano + soundfont-player */}
      <SoundfontProvider audioContext={audioCtxRef.current}>
        {({ isLoading, playNote, stopNote }) => {
          // ref에 저장 (currentNote useEffect에서 사용)
          playNoteRef.current = playNote;
          stopNoteRef.current = stopNote;

          return (
            <div className="scale-piano-wrap" style={{ opacity: isLoading ? 0.5 : 1, transition: 'opacity 0.4s' }}>
              <Piano
                noteRange={{ first, last }}
                playNote={playNote}
                stopNote={stopNote}
                activeNotes={activeNotes}
                width={Math.max(320, Math.min(580, (lastNote - firstNote) * 26))}
                renderNoteLabel={renderNoteLabel}
              />
              {isLoading && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, marginTop: 6 }}>
                  그랜드 피아노 샘플 로딩 중...
                </div>
              )}
            </div>
          );
        }}
      </SoundfontProvider>

      {/* 하단 반사광 */}
      <div style={{
        height: 2, marginTop: 10, borderRadius: 1,
        background: 'linear-gradient(90deg, transparent 15%, rgba(251,191,36,0.08) 50%, transparent 85%)',
      }} />

      {/* react-piano CSS 오버라이드 — 프로페셔널 스타일 */}
      <style jsx global>{`
        .scale-piano-wrap .ReactPiano__Keyboard {
          border-radius: 4px;
          overflow: hidden;
        }
        .scale-piano-wrap .ReactPiano__Key--natural {
          background: linear-gradient(180deg, #fdfdfd 0%, #f0f0f2 60%, #dcdce0 92%, #c8c8cc 100%);
          border: none;
          border-right: 1px solid rgba(0,0,0,0.1);
          border-radius: 0 0 5px 5px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,1), inset 0 -3px 6px rgba(0,0,0,0.04);
          transition: all 0.08s ease;
        }
        .scale-piano-wrap .ReactPiano__Key--natural:hover {
          background: linear-gradient(180deg, #fff 0%, #f4f4f6 60%, #e2e2e6 92%, #d0d0d4 100%);
        }
        .scale-piano-wrap .ReactPiano__Key--accidental {
          background: linear-gradient(180deg, #333340 0%, #1a1a28 55%, #222230 80%, #2a2a38 100%);
          border: none;
          border-radius: 0 0 3px 3px;
          box-shadow: 0 3px 8px rgba(0,0,0,0.5), inset 0 -1px 3px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.06);
          transition: all 0.08s ease;
        }
        .scale-piano-wrap .ReactPiano__Key--accidental:hover {
          background: linear-gradient(180deg, #3d3d4a 0%, #22222f 55%, #2a2a38 80%, #333340 100%);
        }
        .scale-piano-wrap .ReactPiano__Key--active.ReactPiano__Key--natural {
          background: linear-gradient(180deg, #fef9e7 0%, #fbbf24 25%, #d97706 80%, #b45309 100%);
          border-color: rgba(217,119,6,0.5);
          box-shadow: 0 6px 20px rgba(217,119,6,0.35), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -3px 6px rgba(0,0,0,0.08);
          height: 98%;
        }
        .scale-piano-wrap .ReactPiano__Key--active.ReactPiano__Key--accidental {
          background: linear-gradient(180deg, #d97706 0%, #92400e 60%, #78350f 100%);
          box-shadow: 0 3px 14px rgba(217,119,6,0.45), inset 0 -1px 3px rgba(0,0,0,0.3);
          height: 65%;
        }
        .scale-piano-wrap .ReactPiano__NoteLabel--natural {
          color: #888;
          font-size: 10px;
          font-weight: 600;
          font-family: 'Pretendard', -apple-system, sans-serif;
        }
        .scale-piano-wrap .ReactPiano__NoteLabel--accidental {
          color: rgba(255,255,255,0.35);
          font-size: 8px;
          font-weight: 600;
        }
        .scale-piano-wrap .ReactPiano__NoteLabel--active {
          color: #78350f !important;
        }
      `}</style>
    </div>
  );
}
