'use client';

import { useRef, useEffect, useCallback } from 'react';
import { renderDnaConstellation } from '@/lib/canvas/dnaRenderer';
import type { DnaAxis } from '@/types';

interface DnaCanvasProps {
  axes: DnaAxis[];
  width?: number;
  height?: number;
  showLabels?: boolean;
  showValues?: boolean;
  mini?: boolean; // 프로필 카드용 초소형
  className?: string;
}

export default function DnaCanvas({
  axes,
  width = 320,
  height = 320,
  showLabels = true,
  showValues = true,
  mini = false,
  className,
}: DnaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const effectiveWidth = canvas.width;
    const effectiveHeight = canvas.height;

    renderDnaConstellation(ctx, axes, {
      width: effectiveWidth,
      height: effectiveHeight,
      padding: mini ? 8 : 20,
      showLabels: mini ? false : showLabels,
      showValues: mini ? false : showValues,
      animated: false,
    });
  }, [axes, mini, showLabels, showValues]);

  // 초기 렌더링 + axes 변경 시 재렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (mini) {
      canvas.width = 60;
      canvas.height = 60;
    } else {
      canvas.width = width;
      canvas.height = height;
    }

    draw();
  }, [draw, mini, width, height]);

  // 반응형 resize (mini가 아닌 경우)
  useEffect(() => {
    if (mini) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: cw, height: ch } = entry.contentRect;
        if (cw > 0 && ch > 0) {
          canvas.width = cw;
          canvas.height = ch;
          draw();
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [draw, mini]);

  if (mini) {
    return (
      <canvas
        ref={canvasRef}
        width={60}
        height={60}
        style={{ display: 'block' }}
        className={className}
        aria-label="음색 DNA 미니 차트"
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', aspectRatio: '1 / 1', position: 'relative' }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
        aria-label="음색 DNA 별자리 차트"
      />
    </div>
  );
}
