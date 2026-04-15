'use client';

import { useRef, useEffect } from 'react';

interface PitchVisualizerProps {
  targetPitches: number[];
  currentPitch: number | null;
  isActive: boolean;
}

export default function PitchVisualizer({ targetPitches, currentPitch, isActive }: PitchVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, w, h);
    if (targetPitches.length === 0) return;
    const minHz = Math.min(...targetPitches) * 0.8;
    const maxHz = Math.max(...targetPitches) * 1.2;
    const hzToY = (hz: number) => h - ((hz - minHz) / (maxHz - minHz)) * h;
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    targetPitches.forEach((hz, i) => {
      const x = (i / (targetPitches.length - 1)) * w;
      const y = hzToY(hz);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    if (currentPitch && isActive) {
      const y = hzToY(currentPitch);
      ctx.beginPath();
      ctx.arc(w * 0.5, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
    }
  }, [targetPitches, currentPitch, isActive]);

  return <canvas ref={canvasRef} width={320} height={160} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />;
}
