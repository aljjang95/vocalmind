'use client';

import { useRef, useEffect, useCallback } from 'react';

/* ── Types ── */
interface TensionInput {
  laryngeal: number;
  tongueRoot: number;
  jaw: number;
  registerBreak: number;
}

interface VoiceVisualizerProps {
  isRecording: boolean;
  currentPitch?: number;
  tensionData?: TensionInput;
  pitchHistory?: number[];
}

/* ── Helpers ── */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function hzToNoteName(hz: number): string {
  if (hz <= 0) return '--';
  const semitone = 12 * Math.log2(hz / 440);
  const midi = Math.round(semitone) + 69;
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

function hzToCents(hz: number): number {
  if (hz <= 0) return 0;
  const semitone = 12 * Math.log2(hz / 440);
  const nearestSemitone = Math.round(semitone);
  return Math.round((semitone - nearestSemitone) * 100);
}

function hzToY(hz: number, minHz: number, maxHz: number, height: number): number {
  if (hz <= 0) return height;
  const logMin = Math.log2(minHz);
  const logMax = Math.log2(maxHz);
  const logHz = Math.log2(Math.max(hz, minHz));
  const ratio = (logHz - logMin) / (logMax - logMin);
  return height - ratio * height;
}

function tensionColorClass(value: number): string {
  if (value <= 40) return 'bg-green-500/70 shadow-[0_0_8px_rgba(34,197,94,0.4)]';
  if (value <= 70) return 'bg-yellow-500/70 shadow-[0_0_10px_rgba(234,179,8,0.4)] animate-[tensionPulse_1.5s_ease_infinite]';
  return 'bg-rose-600/80 shadow-[0_0_14px_rgba(225,29,72,0.5)] animate-[tensionPulse_0.8s_ease_infinite]';
}

function tensionLegendColor(value: number): string {
  if (value <= 40) return '#22C55E';
  if (value <= 70) return '#EAB308';
  return '#E11D48';
}

/* ── Semitone guide lines for the pitch canvas ── */
function getSemitoneHzInRange(minHz: number, maxHz: number): { hz: number; name: string }[] {
  const result: { hz: number; name: string }[] = [];
  // MIDI 36 (C2) to 84 (C6)
  for (let midi = 36; midi <= 84; midi++) {
    const hz = 440 * Math.pow(2, (midi - 69) / 12);
    if (hz >= minHz && hz <= maxHz) {
      const note = NOTE_NAMES[midi % 12];
      const octave = Math.floor(midi / 12) - 1;
      result.push({ hz, name: `${note}${octave}` });
    }
  }
  return result;
}

/* ── Component ── */
export default function VoiceVisualizer({
  isRecording,
  currentPitch,
  tensionData,
  pitchHistory = [],
}: VoiceVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const drawPitch = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Match canvas internal size to display size
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width * dpr;
    const h = rect.height * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const displayW = rect.width;
    const displayH = rect.height;

    // Clear
    ctx.clearRect(0, 0, displayW, displayH);

    // Range: find adaptive range from history
    const validPitches = pitchHistory.filter((p) => p > 0);
    const minHz = validPitches.length > 0 ? Math.max(60, Math.min(...validPitches) * 0.8) : 80;
    const maxHz = validPitches.length > 0 ? Math.min(1200, Math.max(...validPitches) * 1.2) : 600;

    // Draw semitone guide lines
    const guides = getSemitoneHzInRange(minHz, maxHz);
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    for (const guide of guides) {
      const y = hzToY(guide.hz, minHz, maxHz, displayH);
      const isNatural = !guide.name.includes('#');
      ctx.strokeStyle = isNatural ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(displayW, y);
      ctx.stroke();
      if (isNatural) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillText(guide.name, 4, y - 3);
      }
    }

    // Draw pitch history line
    if (pitchHistory.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = '#E11D48';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      const step = displayW / Math.max(pitchHistory.length - 1, 1);
      let started = false;

      for (let i = 0; i < pitchHistory.length; i++) {
        const p = pitchHistory[i];
        if (p <= 0) {
          started = false;
          continue;
        }
        const x = i * step;
        const y = hzToY(p, minHz, maxHz, displayH);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Glow trail
      ctx.strokeStyle = 'rgba(225,29,72,0.15)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      started = false;
      for (let i = 0; i < pitchHistory.length; i++) {
        const p = pitchHistory[i];
        if (p <= 0) { started = false; continue; }
        const x = i * step;
        const y = hzToY(p, minHz, maxHz, displayH);
        if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();
    }

    // Current pitch dot
    if (currentPitch && currentPitch > 0) {
      const x = displayW - 8;
      const y = hzToY(currentPitch, minHz, maxHz, displayH);

      // Outer glow
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 16);
      grad.addColorStop(0, 'rgba(225,29,72,0.6)');
      grad.addColorStop(1, 'rgba(225,29,72,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();

      // Inner dot
      ctx.fillStyle = '#E11D48';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      // White core
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [pitchHistory, currentPitch]);

  useEffect(() => {
    if (!isRecording) return;

    const tick = () => {
      drawPitch();
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animRef.current);
  }, [isRecording, drawPitch]);

  // Draw once even when not animating (for static display after stop)
  useEffect(() => {
    if (!isRecording && pitchHistory.length > 0) {
      drawPitch();
    }
  }, [isRecording, pitchHistory, drawPitch]);

  if (!isRecording && pitchHistory.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[260px] bg-white/[0.02] border border-dashed border-white/[0.08] rounded-xl text-[var(--text-muted)] text-sm gap-2">
        <span className="text-xl opacity-50">&#127908;</span>
        녹음을 시작하면 실시간 시각화가 표시됩니다
      </div>
    );
  }

  const cents = currentPitch ? hzToCents(currentPitch) : 0;
  const noteName = currentPitch && currentPitch > 0 ? hzToNoteName(currentPitch) : '--';

  const lary = tensionData?.laryngeal ?? 0;
  const tongue = tensionData?.tongueRoot ?? 0;
  const jaw = tensionData?.jaw ?? 0;

  return (
    <div className="grid grid-cols-[1fr_200px] gap-4 bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 min-h-[260px] max-sm:grid-cols-1 max-sm:min-h-auto">
      {/* Left: Pitch Curve */}
      <div className="relative overflow-hidden rounded-lg bg-black/30 max-sm:min-h-[180px]">
        <canvas ref={canvasRef} className="block w-full h-full" />
        <div className="absolute top-3 right-3 flex flex-col items-end gap-0.5 pointer-events-none">
          <span className="font-mono text-[28px] font-bold text-[var(--accent)] leading-none" style={{ textShadow: '0 0 20px var(--accent-glow)' }}>
            {noteName}
          </span>
          {currentPitch && currentPitch > 0 && (
            <span className={`font-mono text-xs ${cents > 0 ? 'text-[var(--accent-gold)]' : cents < 0 ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
              {cents > 0 ? '+' : ''}{cents} cents
            </span>
          )}
        </div>
      </div>

      {/* Right: Body Map */}
      <div className="flex flex-col items-center gap-2 max-sm:flex-row max-sm:justify-center max-sm:gap-4">
        <span className="text-[11px] font-semibold text-[var(--text-muted)] tracking-[0.08em] uppercase">긴장 지도</span>
        <div className="relative w-[120px] h-[180px] shrink-0 max-sm:w-[90px] max-sm:h-[135px]">
          {/* Simple human silhouette SVG */}
          <svg className="w-full h-full opacity-40" viewBox="0 0 120 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Head */}
            <circle cx="60" cy="30" r="22" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
            {/* Neck */}
            <rect x="52" y="52" width="16" height="20" rx="4" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />
            {/* Shoulders + Torso */}
            <path
              d="M20 82 Q30 72 52 72 L68 72 Q90 72 100 82 L100 140 Q100 150 90 155 L30 155 Q20 150 20 140 Z"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.2"
            />
            {/* Throat line */}
            <line x1="60" y1="55" x2="60" y2="68" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 2" />
          </svg>

          {/* Tension indicators */}
          <div
            className={`absolute w-6 h-6 rounded-full -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[8px] font-bold text-white/90 transition-all duration-300 ${tensionColorClass(tongue)}`}
            style={{ top: '30%', left: '50%' }}
          >
            {tongue}
          </div>
          <div
            className={`absolute w-6 h-6 rounded-full -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[8px] font-bold text-white/90 transition-all duration-300 ${tensionColorClass(lary)}`}
            style={{ top: '42%', left: '50%' }}
          >
            {lary}
          </div>
          <div
            className={`absolute w-6 h-6 rounded-full -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[8px] font-bold text-white/90 transition-all duration-300 ${tensionColorClass(jaw)}`}
            style={{ top: '54%', left: '50%' }}
          >
            {jaw}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1 w-full max-sm:w-auto">
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tensionLegendColor(tongue) }} />
            혀뿌리
            <span className="ml-auto font-mono text-[10px] font-semibold" style={{ color: tensionLegendColor(tongue) }}>{tongue}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tensionLegendColor(lary) }} />
            후두
            <span className="ml-auto font-mono text-[10px] font-semibold" style={{ color: tensionLegendColor(lary) }}>{lary}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tensionLegendColor(jaw) }} />
            턱
            <span className="ml-auto font-mono text-[10px] font-semibold" style={{ color: tensionLegendColor(jaw) }}>{jaw}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
