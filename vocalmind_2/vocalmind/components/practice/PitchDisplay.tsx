'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  startPitchDetection,
  stopPitchDetection,
  isPitchDetectionActive,
} from '@/lib/audio/pitchDetector';
import type { PitchData } from '@/lib/audio/pitchDetector';
import { PITCH_CENTS_GOOD, PITCH_CENTS_OK } from '@/lib/audio/constants';
import { usePracticeStore } from '@/stores/practiceStore';

const HISTORY_DURATION_SEC = 5;
const MAX_HISTORY = 250; // ~50 updates/sec * 5s

interface PitchPoint {
  time: number; // performance.now()
  frequency: number;
  noteName: string;
  cents: number;
}

// Frequency range for visualization (log scale)
const MIN_FREQ = 80; // ~E2
const MAX_FREQ = 1200; // ~D6

function freqToY(freq: number, height: number): number {
  const logMin = Math.log2(MIN_FREQ);
  const logMax = Math.log2(MAX_FREQ);
  const logFreq = Math.log2(Math.max(MIN_FREQ, Math.min(MAX_FREQ, freq)));
  const ratio = (logFreq - logMin) / (logMax - logMin);
  return height * (1 - ratio);
}

export default function PitchDisplay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<PitchPoint[]>([]);
  const animRef = useRef<number>(0);
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [currentPitch, setCurrentPitch] = useState<PitchData | null>(null);
  const { currentAnalysis, currentTime } = usePracticeStore();

  const onPitch = useCallback((data: PitchData) => {
    setCurrentPitch(data);
    const now = performance.now();
    historyRef.current.push({
      time: now,
      frequency: data.frequency,
      noteName: data.noteName,
      cents: data.cents,
    });
    // Trim old points
    const cutoff = now - HISTORY_DURATION_SEC * 1000;
    while (historyRef.current.length > 0 && historyRef.current[0].time < cutoff) {
      historyRef.current.shift();
    }
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current = historyRef.current.slice(-MAX_HISTORY);
    }
  }, []);

  const toggleMic = useCallback(async () => {
    if (micActive) {
      stopPitchDetection();
      setMicActive(false);
      setCurrentPitch(null);
      historyRef.current = [];
      return;
    }

    setMicError(null);
    try {
      await startPitchDetection(onPitch);
      setMicActive(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setMicError('마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.');
      } else {
        setMicError('마이크를 사용할 수 없습니다. 마이크가 연결되어 있는지 확인해주세요.');
      }
    }
  }, [micActive, onPitch]);

  // Canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      if (!canvas || !ctx) return;

      // Handle DPI scaling
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      const w = rect.width;
      const h = rect.height;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Draw grid lines for note reference
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const noteFreqs = [100, 200, 300, 400, 600, 800, 1000];
      for (const f of noteFreqs) {
        const y = freqToY(f, h);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText(`${f}Hz`, 4, y - 3);
      }

      // Draw melody guide overlay (if analysis is available)
      const melodyData = currentAnalysis?.melodyData;
      if (melodyData && melodyData.length > 1 && micActive) {
        const playTime = currentTime; // current playback time in seconds
        const windowStartTime = playTime - HISTORY_DURATION_SEC;
        const windowEndTime = playTime;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        let melodyStarted = false;

        for (const mp of melodyData) {
          if (mp.frequency <= 0) {
            melodyStarted = false;
            continue;
          }
          if (mp.time < windowStartTime || mp.time > windowEndTime) continue;

          const x = ((mp.time - windowStartTime) / HISTORY_DURATION_SEC) * w;
          const y = freqToY(mp.frequency, h);

          if (!melodyStarted) {
            ctx.moveTo(x, y);
            melodyStarted = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw pitch history
      const history = historyRef.current;
      if (history.length < 2) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const now = performance.now();
      const windowStart = now - HISTORY_DURATION_SEC * 1000;

      // Draw connecting lines
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;

      for (const point of history) {
        const x = ((point.time - windowStart) / (HISTORY_DURATION_SEC * 1000)) * w;
        const y = freqToY(point.frequency, h);

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Draw dots
      for (const point of history) {
        const x = ((point.time - windowStart) / (HISTORY_DURATION_SEC * 1000)) * w;
        const y = freqToY(point.frequency, h);
        const age = (now - point.time) / (HISTORY_DURATION_SEC * 1000);
        const alpha = Math.max(0.2, 1 - age);

        ctx.fillStyle = `rgba(96, 165, 250, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isPitchDetectionActive()) {
        stopPitchDetection();
      }
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  const centsClass = currentPitch
    ? Math.abs(currentPitch.cents) <= PITCH_CENTS_GOOD
      ? "text-[var(--success)]"
      : Math.abs(currentPitch.cents) <= PITCH_CENTS_OK
        ? "text-[var(--warning)]"
        : "text-[var(--error)]"
    : '';

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-[var(--text)]">음정 모니터</span>
        <button
          className={`${"flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-xs cursor-pointer transition-all hover:bg-[var(--surface2)] hover:text-[var(--text)]"} ${micActive ? "bg-blue-500/[0.15] border-[var(--accent)] text-[var(--accent-lt)] hover:bg-blue-500/20" : ''}`}
          onClick={toggleMic}
        >
          <span className={`${"w-1.5 h-1.5 rounded-full bg-[var(--muted)]"} ${micActive ? "bg-[var(--accent)] animate-pulse" : ''}`} />
          {micActive ? '마이크 끄기' : '마이크 켜기'}
        </button>
      </div>

      {micError ? (
        <div className="flex items-center justify-center p-5 text-center text-[var(--text2)] text-sm leading-relaxed">{micError}</div>
      ) : (
        <>
          <div className="relative w-full h-[160px] bg-[var(--bg3)] rounded-md overflow-hidden">
            {micActive ? (
              <canvas ref={canvasRef} className="w-full h-full block" />
            ) : (
              <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
                마이크를 켜면 실시간 음정이 표시됩니다
              </div>
            )}
          </div>

          {micActive && currentPitch && (
            <div className="flex items-center justify-center gap-4 mt-2.5">
              <span className="text-2xl font-bold text-[var(--accent-lt)] font-[Inter,monospace]">{currentPitch.noteName}</span>
              <span className={`${"text-sm text-[var(--text2)] font-[Inter,monospace]"} ${centsClass}`}>
                {currentPitch.cents > 0 ? '+' : ''}{currentPitch.cents} cents
              </span>
              <span className="text-xs text-[var(--muted)]">
                {currentPitch.frequency.toFixed(1)} Hz
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
