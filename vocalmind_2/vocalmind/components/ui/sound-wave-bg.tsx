'use client';

import { useEffect, useRef } from 'react';

export function SoundWaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const waves = [
      { amplitude: 30, frequency: 0.008, speed: 0.015, alpha: 0.08, blur: 20 },
      { amplitude: 20, frequency: 0.012, speed: 0.020, alpha: 0.06, blur: 30 },
      { amplitude: 40, frequency: 0.005, speed: 0.010, alpha: 0.05, blur: 40 },
      { amplitude: 15, frequency: 0.015, speed: 0.025, alpha: 0.04, blur: 50 },
      { amplitude: 25, frequency: 0.010, speed: 0.018, alpha: 0.07, blur: 25 },
      { amplitude: 35, frequency: 0.007, speed: 0.012, alpha: 0.05, blur: 35 },
    ];

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerY = canvas.height * 0.5;

      for (const w of waves) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(100, 200, 140, ${w.alpha})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(80, 180, 120, 0.4)';
        ctx.shadowBlur = w.blur;

        for (let x = 0; x < canvas.width; x += 3) {
          const y = centerY +
            Math.sin(x * w.frequency + time * w.speed) * w.amplitude;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      time += 1;
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none opacity-60"
      aria-hidden="true"
    />
  );
}
