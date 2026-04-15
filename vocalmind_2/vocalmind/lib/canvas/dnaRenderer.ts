import type { DnaAxis } from '@/types';

export interface DnaRenderOptions {
  width: number;
  height: number;
  padding: number;
  showLabels: boolean;
  showValues: boolean;
  animated: boolean;
}

const AXIS_LABELS: Record<string, string> = {
  laryngeal: '후두',
  tongue_root: '혀뿌리',
  jaw: '턱',
  register_break: '성구전환',
  tone_stability: '음색안정',
};

// 5각형 꼭짓점 각도 (12시 방향부터 시계방향)
function getVertexAngle(index: number, total: number): number {
  return (Math.PI * 2 * index) / total - Math.PI / 2;
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): { x: number; y: number } {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

export function renderDnaConstellation(
  ctx: CanvasRenderingContext2D,
  axes: DnaAxis[],
  options: DnaRenderOptions,
): void {
  const { width, height, padding, showLabels, showValues } = options;

  // 1. 배경 클리어
  ctx.clearRect(0, 0, width, height);

  // CSS 변수 읽기 (canvas는 DOM 외부이므로 document.documentElement에서)
  const style = getComputedStyle(document.documentElement);
  const starColor = style.getPropertyValue('--dna-star').trim() || '#A8D4B8';
  const lineColor = style.getPropertyValue('--dna-line').trim() || 'rgba(168,212,184,0.4)';
  const fillColor = style.getPropertyValue('--dna-fill').trim() || 'rgba(91,140,110,0.15)';
  const textColor = style.getPropertyValue('--text-secondary').trim() || '#7A8A80';
  const textDim = style.getPropertyValue('--text-dim').trim() || '#3A4A40';

  const n = axes.length; // 5
  if (n < 3) return;

  // 2. 중심점 계산
  const labelPadding = showLabels ? 32 : 0;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(width, height) / 2 - padding - labelPadding;

  // 3. 가이드라인 — 3단계 (33%, 66%, 100%)
  const guideSteps = [0.33, 0.66, 1.0];
  for (const step of guideSteps) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = getVertexAngle(i, n);
      const { x, y } = polarToCartesian(cx, cy, maxRadius * step, angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = textDim;
    ctx.lineWidth = step === 1.0 ? 1.0 : 0.6;
    ctx.globalAlpha = step === 1.0 ? 0.5 : 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // 축 가이드라인 (중심 → 꼭짓점)
  for (let i = 0; i < n; i++) {
    const angle = getVertexAngle(i, n);
    const { x, y } = polarToCartesian(cx, cy, maxRadius, angle);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = textDim;
    ctx.lineWidth = 0.6;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // 4. 데이터 다각형
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const angle = getVertexAngle(i, n);
    const radius = (axes[i].value / 100) * maxRadius;
    const { x, y } = polarToCartesian(cx, cy, radius, angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  // 채우기
  ctx.fillStyle = fillColor;
  ctx.fill();

  // 테두리
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 5. 각 꼭짓점에 별 (원 + shadowBlur)
  for (let i = 0; i < n; i++) {
    const angle = getVertexAngle(i, n);
    const radius = (axes[i].value / 100) * maxRadius;
    const { x, y } = polarToCartesian(cx, cy, radius, angle);

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = starColor;
    ctx.shadowColor = starColor;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }

  // 6. 라벨 (showLabels=true 시)
  if (showLabels) {
    ctx.font = `11px 'Inter', 'Noto Sans KR', sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < n; i++) {
      const angle = getVertexAngle(i, n);
      const labelRadius = maxRadius + 20;
      const { x, y } = polarToCartesian(cx, cy, labelRadius, angle);
      const label = AXIS_LABELS[axes[i].key] ?? axes[i].label;
      ctx.fillText(label, x, y);
    }
  }

  // 7. 값 (showValues=true 시)
  if (showValues) {
    ctx.font = `bold 10px 'Inter', monospace`;
    ctx.fillStyle = starColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < n; i++) {
      const angle = getVertexAngle(i, n);
      const radius = (axes[i].value / 100) * maxRadius;
      const offsetRadius = radius + 12;
      const { x, y } = polarToCartesian(cx, cy, offsetRadius, angle);
      ctx.fillText(String(Math.round(axes[i].value)), x, y);
    }
  }
}
