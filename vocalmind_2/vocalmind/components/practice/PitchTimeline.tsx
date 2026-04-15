'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import { frequencyToMidi, midiToNoteName, midiToFrequency } from '@/lib/audio/musicUtils';
import { SEMITONES_PER_OCTAVE, A4_FREQUENCY, A4_MIDI_NOTE } from '@/lib/audio/constants';
import type { MelodyPoint, SongSection, SessionScore, SongAnalysis } from '@/types';

// ── Constants ──

const MIN_MIDI = 36; // C2
const MAX_MIDI = 84; // C7
const PIXELS_PER_SECOND_BASE = 80;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const CENTS_GOOD = 15;
const CENTS_BAD = 30;

// ── Helpers ──

function freqToMidiExact(freq: number): number {
  if (freq <= 0) return 0;
  return SEMITONES_PER_OCTAVE * Math.log2(freq / A4_FREQUENCY) + A4_MIDI_NOTE;
}

function midiToY(midi: number, height: number, midiLow: number, midiHigh: number): number {
  const range = midiHigh - midiLow;
  if (range <= 0) return height / 2;
  const ratio = (midi - midiLow) / range;
  return height * (1 - ratio);
}

function centsBetween(freqA: number, freqB: number): number {
  if (freqA <= 0 || freqB <= 0) return Infinity;
  return Math.abs(1200 * Math.log2(freqA / freqB));
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getDeviationDirection(userFreq: number, refFreq: number): string {
  if (userFreq <= 0 || refFreq <= 0) return '';
  const diff = 1200 * Math.log2(userFreq / refFreq);
  if (diff > 0) return '위로 올라갔습니다';
  return '아래로 떨어졌습니다';
}

function getDeviationAmount(userFreq: number, refFreq: number): string {
  if (userFreq <= 0 || refFreq <= 0) return '';
  const semitoneDiff = Math.abs(12 * Math.log2(userFreq / refFreq));
  if (semitoneDiff < 1) return '반음 미만';
  if (semitoneDiff < 2) return '반음';
  if (semitoneDiff < 3) return '온음';
  return `${Math.round(semitoneDiff)}반음`;
}

// ── Feedback generation ──

interface FeedbackItem {
  time: number;
  text: string;
}

function generateFeedback(
  userPitch: MelodyPoint[],
  referenceMelody: MelodyPoint[],
  keyShift: number,
): FeedbackItem[] {
  if (userPitch.length === 0 || referenceMelody.length === 0) return [];

  const shiftedRef = referenceMelody.map((p) => {
    if (p.frequency <= 0) return p;
    const shifted = p.frequency * Math.pow(2, keyShift / SEMITONES_PER_OCTAVE);
    return { ...p, frequency: shifted };
  });

  const deviations: { time: number; userFreq: number; refFreq: number; cents: number }[] = [];

  for (const up of userPitch) {
    if (up.frequency <= 0) continue;

    // Binary search for closest reference point
    let lo = 0;
    let hi = shiftedRef.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (shiftedRef[mid].time < up.time) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) {
      const diffPrev = Math.abs(shiftedRef[lo - 1].time - up.time);
      const diffCurr = Math.abs(shiftedRef[lo].time - up.time);
      if (diffPrev < diffCurr) lo = lo - 1;
    }
    const ref = shiftedRef[lo];
    if (!ref || ref.frequency <= 0) continue;
    if (Math.abs(ref.time - up.time) > 0.15) continue;

    const c = centsBetween(up.frequency, ref.frequency);
    if (c > CENTS_BAD) {
      deviations.push({ time: up.time, userFreq: up.frequency, refFreq: ref.frequency, cents: c });
    }
  }

  // Group consecutive deviations (within 0.5s) and pick the worst in each group
  const groups: typeof deviations = [];
  for (const d of deviations) {
    const last = groups[groups.length - 1];
    if (last && d.time - last.time < 0.5) {
      if (d.cents > last.cents) {
        groups[groups.length - 1] = d;
      }
    } else {
      groups.push(d);
    }
  }

  // Sort by cents descending, take top 10
  const sorted = groups.sort((a, b) => b.cents - a.cents).slice(0, 10);
  // Re-sort by time for display
  sorted.sort((a, b) => a.time - b.time);

  return sorted.map((d) => ({
    time: d.time,
    text: `${getDeviationAmount(d.userFreq, d.refFreq)} ${getDeviationDirection(d.userFreq, d.refFreq)}`,
  }));
}

// ── Section score calculation ──

interface SectionScoreInfo {
  index: number;
  label: string;
  score: number;
  startTime: number;
  endTime: number;
}

function computeSectionScores(
  session: SessionScore,
  sections: SongSection[],
): SectionScoreInfo[] {
  if (sections.length === 0) {
    // Treat entire duration as one section
    return [{
      index: 0,
      label: '전체',
      score: session.overallScore,
      startTime: 0,
      endTime: session.duration,
    }];
  }

  return sections.map((sec, i) => {
    const found = session.sectionScores.find((ss) => ss.sectionIndex === i);
    return {
      index: i,
      label: sec.label,
      score: found?.score ?? 0,
      startTime: sec.startTime,
      endTime: sec.endTime,
    };
  });
}

// ── Component ──

interface PitchTimelineProps {
  session: SessionScore;
  analysis: SongAnalysis | null;
}

export default function PitchTimeline({ session, analysis }: PitchTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const [zoom, setZoom] = useState(1);
  const [scrollOffset, setScrollOffset] = useState(0); // in pixels
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartOffset = useRef(0);

  const { setMode, setLoop, setShowResult } = usePracticeStore();

  // Derived data
  const referenceMelody = analysis?.melodyData ?? [];
  const sections = analysis?.sections ?? [];
  const userPitch = session.userPitchData;

  const totalDuration = useMemo(() => {
    let maxTime = session.duration;
    if (referenceMelody.length > 0) {
      maxTime = Math.max(maxTime, referenceMelody[referenceMelody.length - 1].time);
    }
    if (userPitch.length > 0) {
      maxTime = Math.max(maxTime, userPitch[userPitch.length - 1].time);
    }
    return Math.max(maxTime, 1);
  }, [session.duration, referenceMelody, userPitch]);

  const pixelsPerSecond = PIXELS_PER_SECOND_BASE * zoom;
  const totalWidth = totalDuration * pixelsPerSecond;

  // Compute MIDI range from data
  const { midiLow, midiHigh } = useMemo(() => {
    let lo = MAX_MIDI;
    let hi = MIN_MIDI;
    const allPoints = [...referenceMelody, ...userPitch];
    for (const p of allPoints) {
      if (p.frequency <= 0) continue;
      const m = freqToMidiExact(p.frequency);
      if (m < lo) lo = m;
      if (m > hi) hi = m;
    }
    // Add padding
    lo = Math.max(MIN_MIDI, Math.floor(lo) - 3);
    hi = Math.min(MAX_MIDI, Math.ceil(hi) + 3);
    if (lo >= hi) { lo = 48; hi = 72; }
    return { midiLow: lo, midiHigh: hi };
  }, [referenceMelody, userPitch]);

  // Section scores
  const sectionScores = useMemo(
    () => computeSectionScores(session, sections),
    [session, sections],
  );

  // Best / worst sections
  const bestSection = useMemo(() => {
    if (sectionScores.length <= 1) return null;
    return sectionScores.reduce((a, b) => (a.score >= b.score ? a : b));
  }, [sectionScores]);

  const worstSection = useMemo(() => {
    if (sectionScores.length <= 1) return null;
    return sectionScores.reduce((a, b) => (a.score <= b.score ? a : b));
  }, [sectionScores]);

  // Feedback
  const feedback = useMemo(
    () => generateFeedback(userPitch, referenceMelody, session.keyShift),
    [userPitch, referenceMelody, session.keyShift],
  );

  // ── Scroll / Zoom handlers ──

  const clampOffset = useCallback((offset: number) => {
    const container = containerRef.current;
    if (!container) return 0;
    const containerWidth = container.clientWidth;
    const maxOffset = Math.max(0, totalWidth - containerWidth);
    return Math.max(0, Math.min(maxOffset, offset));
  }, [totalWidth]);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Zoom with Ctrl+scroll
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
    } else {
      // Horizontal scroll
      setScrollOffset((prev) => clampOffset(prev + e.deltaY));
    }
  }, [clampOffset]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartOffset.current = scrollOffset;
  }, [scrollOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = dragStartX.current - e.clientX;
    setScrollOffset(clampOffset(dragStartOffset.current + dx));
  }, [clampOffset]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Scroll to a specific time
  const scrollToTime = useCallback((timeSec: number) => {
    const container = containerRef.current;
    if (!container) return;
    const targetPx = timeSec * pixelsPerSecond - container.clientWidth / 2;
    setScrollOffset(clampOffset(targetPx));
  }, [pixelsPerSecond, clampOffset]);

  // ── Section click: scroll to section ──
  const handleSectionClick = useCallback((sec: SectionScoreInfo) => {
    scrollToTime(sec.startTime);
  }, [scrollToTime]);

  // ── "이 구간 연습하기" button ──
  const handlePracticeSection = useCallback((sec: SectionScoreInfo) => {
    setShowResult(false);
    setMode('practice');
    setLoop(sec.startTime, sec.endTime);
  }, [setShowResult, setMode, setLoop]);

  // ── Feedback click ──
  const handleFeedbackClick = useCallback((fb: FeedbackItem) => {
    scrollToTime(fb.time);
  }, [scrollToTime]);

  // ── Canvas rendering ──

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      if (!canvas || !ctx || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Visible time range
      const timeStart = scrollOffset / pixelsPerSecond;
      const timeEnd = (scrollOffset + w) / pixelsPerSecond;

      // ── Draw grid lines (horizontal = notes) ──
      ctx.textBaseline = 'middle';
      for (let midi = Math.ceil(midiLow); midi <= Math.floor(midiHigh); midi++) {
        const y = midiToY(midi, h, midiLow, midiHigh);
        const isC = midi % SEMITONES_PER_OCTAVE === 0; // C notes
        ctx.strokeStyle = isC ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
        ctx.lineWidth = isC ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();

        // Label every C and every 4th note
        if (isC || midi % 4 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.font = '9px Inter, sans-serif';
          ctx.fillText(midiToNoteName(midi), 4, y - 1);
        }
      }

      // ── Draw vertical time markers ──
      const timeStep = zoom >= 2 ? 1 : zoom >= 1 ? 2 : 5;
      const firstMark = Math.ceil(timeStart / timeStep) * timeStep;
      for (let t = firstMark; t <= timeEnd; t += timeStep) {
        const x = (t - timeStart) * pixelsPerSecond;
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.fillText(formatTime(t), x + 3, h - 3);
      }

      // ── Draw section boundaries ──
      for (const sec of sections) {
        if (sec.endTime < timeStart || sec.startTime > timeEnd) continue;
        const x = (sec.startTime - timeStart) * pixelsPerSecond;
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        ctx.setLineDash([]);

        // Section label
        ctx.fillStyle = 'rgba(139, 92, 246, 0.5)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(sec.label, x + 4, 4);
      }

      // ── Draw reference melody (gray) ──
      if (referenceMelody.length > 1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let started = false;

        for (const p of referenceMelody) {
          if (p.time < timeStart - 0.5 || p.time > timeEnd + 0.5) continue;
          if (p.frequency <= 0) {
            started = false;
            continue;
          }
          const x = (p.time - timeStart) * pixelsPerSecond;
          const midi = freqToMidiExact(p.frequency);
          const y = midiToY(midi, h, midiLow, midiHigh);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // ── Draw user pitch (colored by accuracy) ──
      if (userPitch.length > 1) {
        // Apply key shift to reference for comparison
        const shiftedRef = referenceMelody.map((p) => {
          if (p.frequency <= 0) return p;
          return {
            ...p,
            frequency: p.frequency * Math.pow(2, session.keyShift / SEMITONES_PER_OCTAVE),
          };
        });

        // Draw segments between consecutive points
        let prevPoint: { x: number; y: number; freq: number } | null = null;

        for (const p of userPitch) {
          if (p.time < timeStart - 0.5 || p.time > timeEnd + 0.5) {
            prevPoint = null;
            continue;
          }
          if (p.frequency <= 0) {
            prevPoint = null;
            continue;
          }

          const x = (p.time - timeStart) * pixelsPerSecond;
          const midi = freqToMidiExact(p.frequency);
          const y = midiToY(midi, h, midiLow, midiHigh);

          // Find closest reference for coloring
          let color = '#22C55E'; // good (green)
          if (shiftedRef.length > 0) {
            // Quick search
            let lo = 0;
            let hi = shiftedRef.length - 1;
            while (lo < hi) {
              const mid = (lo + hi) >> 1;
              if (shiftedRef[mid].time < p.time) lo = mid + 1;
              else hi = mid;
            }
            if (lo > 0) {
              const dp = Math.abs(shiftedRef[lo - 1].time - p.time);
              const dc = Math.abs(shiftedRef[lo].time - p.time);
              if (dp < dc) lo = lo - 1;
            }
            const ref = shiftedRef[lo];
            if (ref && ref.frequency > 0 && Math.abs(ref.time - p.time) < 0.15) {
              const c = centsBetween(p.frequency, ref.frequency);
              if (c > CENTS_BAD) color = '#EF4444'; // red
              else if (c > CENTS_GOOD) color = '#EAB308'; // yellow
            }
          }

          if (prevPoint) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(prevPoint.x, prevPoint.y);
            ctx.lineTo(x, y);
            ctx.stroke();
          }

          // Draw dot
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();

          prevPoint = { x, y, freq: p.frequency };
        }
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [
    scrollOffset, pixelsPerSecond, zoom, midiLow, midiHigh,
    referenceMelody, userPitch, sections, session.keyShift,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Clamp offset when zoom changes
  useEffect(() => {
    setScrollOffset((prev) => clampOffset(prev));
  }, [zoom, clampOffset]);

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
        <span className="text-sm font-bold text-[var(--text)]">피치 타임라인 분석</span>
        <div className="flex items-center gap-1.5">
          <button className="flex items-center justify-center w-7 h-7 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-sm font-bold cursor-pointer transition-all select-none hover:bg-[var(--surface2)] hover:text-[var(--text)]" onClick={handleZoomOut} aria-label="축소">
            -
          </button>
          <span className="text-xs text-[var(--muted)] min-w-[36px] text-center font-[Inter,monospace]">{Math.round(zoom * 100)}%</span>
          <button className="flex items-center justify-center w-7 h-7 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-sm font-bold cursor-pointer transition-all select-none hover:bg-[var(--surface2)] hover:text-[var(--text)]" onClick={handleZoomIn} aria-label="확대">
            +
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-5 px-5 py-2.5 bg-[var(--surface)] border-b border-[var(--border)] flex-wrap">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[var(--muted)]">전체 정확도</span>
          <span className="text-[var(--text)] font-semibold font-[Inter,monospace]">{session.overallScore}%</span>
        </div>
        {bestSection && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[var(--muted)]">최고 구간</span>
            <span className={`${"text-[var(--text)] font-semibold font-[Inter,monospace]"} ${"text-[var(--success)]"}`}>
              {bestSection.label} {bestSection.score}%
            </span>
          </div>
        )}
        {worstSection && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[var(--muted)]">취약 구간</span>
            <span className={`${"text-[var(--text)] font-semibold font-[Inter,monospace]"} ${"text-[var(--error-lt)]"}`}>
              {worstSection.label} {worstSection.score}%
            </span>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative w-full h-[250px] overflow-hidden cursor-grab bg-[var(--bg3)] active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-2 border-t border-[var(--border)] max-[700px]:grid-cols-1">
        {/* Section scores */}
        <div className="px-5 py-3.5 border-r border-[var(--border)] max-[700px]:border-r-0 max-[700px]:border-b max-[700px]:border-[var(--border)]">
          <div className="text-xs font-semibold text-[var(--text2)] mb-2.5 uppercase tracking-wide">구간별 점수</div>
          <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
            {sectionScores.map((sec) => (
              <div
                key={sec.index}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors hover:bg-[var(--surface2)]"
                onClick={() => handleSectionClick(sec)}
              >
                <span className="flex-1 text-xs text-[var(--text)] font-medium">{sec.label}</span>
                <div className="flex-1 h-1 bg-[var(--surface2)] rounded-sm overflow-hidden">
                  <div
                    className={`${"h-full rounded-sm transition-[width] duration-300 ease-out"} ${
                      sec.score >= 80
                        ? "bg-[var(--success)]"
                        : sec.score >= 60
                          ? "bg-[var(--warning)]"
                          : "bg-[var(--error)]"
                    }`}
                    style={{ width: `${sec.score}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--text2)] font-semibold font-[Inter,monospace] min-w-[32px] text-right">{sec.score}%</span>
                <button
                  className="mt-1 px-3 py-1.5 text-xs font-semibold text-[var(--accent-lt)] bg-blue-500/10 border border-blue-500/25 rounded-md cursor-pointer transition-colors whitespace-nowrap hover:bg-blue-500/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePracticeSection(sec);
                  }}
                >
                  연습하기
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback */}
        <div className="px-5 py-3.5">
          <div className="text-xs font-semibold text-[var(--text2)] mb-2.5 uppercase tracking-wide">피드백</div>
          {feedback.length > 0 ? (
            <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
              {feedback.map((fb, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors hover:bg-[var(--surface2)]"
                  onClick={() => handleFeedbackClick(fb)}
                >
                  <span className="text-xs text-[var(--accent-lt)] font-[Inter,monospace] font-semibold min-w-[40px] shrink-0">{formatTime(fb.time)}</span>
                  <span className="text-xs text-[var(--text2)] leading-relaxed">{fb.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-[var(--muted)] py-2.5 text-center">
              크게 이탈한 구간이 없습니다
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 px-5 py-2.5 border-t border-[var(--border)]">
        <div className="flex items-center gap-[5px] text-xs text-[var(--muted)]">
          <span className={`${"w-2 h-[3px] rounded-sm"} ${"bg-white/30"}`} />
          원곡 멜로디
        </div>
        <div className="flex items-center gap-[5px] text-xs text-[var(--muted)]">
          <span className={`${"w-2 h-[3px] rounded-sm"} ${"bg-[var(--success)]"}`} />
          정확 (15c 이내)
        </div>
        <div className="flex items-center gap-[5px] text-xs text-[var(--muted)]">
          <span className={`${"w-2 h-[3px] rounded-sm"} ${"bg-[var(--warning)]"}`} />
          약간 이탈 (30c 이내)
        </div>
        <div className="flex items-center gap-[5px] text-xs text-[var(--muted)]">
          <span className={`${"w-2 h-[3px] rounded-sm"} ${"bg-[var(--error)]"}`} />
          크게 이탈 (30c 초과)
        </div>
      </div>
    </div>
  );
}
