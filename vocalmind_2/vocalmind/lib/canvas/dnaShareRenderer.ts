import type { DnaAxis } from '@/types';
import { renderDnaConstellation } from './dnaRenderer';

const SHARE_WIDTH = 1080;
const SHARE_HEIGHT = 1350;

const AXIS_LABELS: Record<string, string> = {
  laryngeal: '후두',
  tongue_root: '혀뿌리',
  jaw: '턱',
  register_break: '성구전환',
  tone_stability: '음색안정',
};

function drawGrainTexture(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // 미세한 노이즈 텍스처 (간소화 버전)
  ctx.save();
  ctx.globalAlpha = 0.04;
  for (let x = 0; x < w; x += 2) {
    for (let y = 0; y < h; y += 2) {
      const v = Math.random() > 0.5 ? 255 : 0;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.globalAlpha = 1.0;
  ctx.restore();
}

function drawAxisBar(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: number,
  x: number,
  y: number,
  barWidth: number,
): void {
  const barHeight = 6;
  const starColor = '#A8D4B8';
  const dimColor = 'rgba(168,212,184,0.15)';
  const textColor = '#7A8A80';

  // 라벨
  ctx.font = `500 28px 'Inter', sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y);

  // 값
  ctx.font = `bold 28px 'Inter', monospace`;
  ctx.fillStyle = starColor;
  ctx.textAlign = 'right';
  ctx.fillText(String(Math.round(value)), x + barWidth, y);

  // 배경 바
  ctx.fillStyle = dimColor;
  ctx.beginPath();
  ctx.roundRect(x, y + 20, barWidth, barHeight, 3);
  ctx.fill();

  // 채워진 바
  const fillW = (value / 100) * barWidth;
  ctx.fillStyle = starColor;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.roundRect(x, y + 20, fillW, barHeight, 3);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

export function renderDnaShareCard(
  axes: DnaAxis[],
  userName: string,
  voiceType: string | null,
  avgPitch: number | null,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // 배경
  ctx.fillStyle = '#060A08';
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  // Grain 텍스처
  drawGrainTexture(ctx, SHARE_WIDTH, SHARE_HEIGHT);

  // 상단 별자리 영역 (1/3)
  const constellationSize = 600;
  const constellationX = (SHARE_WIDTH - constellationSize) / 2;
  const constellationY = 80;

  // 별자리 오프스크린 캔버스
  const offscreen = document.createElement('canvas');
  offscreen.width = constellationSize;
  offscreen.height = constellationSize;
  const offCtx = offscreen.getContext('2d')!;

  renderDnaConstellation(offCtx, axes, {
    width: constellationSize,
    height: constellationSize,
    padding: 40,
    showLabels: true,
    showValues: true,
    animated: false,
  });

  ctx.drawImage(offscreen, constellationX, constellationY);

  // 구분선
  ctx.strokeStyle = 'rgba(168,212,184,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, constellationY + constellationSize + 40);
  ctx.lineTo(SHARE_WIDTH - 80, constellationY + constellationSize + 40);
  ctx.stroke();

  // 중간: 사용자 이름
  const midY = constellationY + constellationSize + 100;

  ctx.font = `700 72px 'Crimson Pro', Georgia, serif`;
  ctx.fillStyle = '#E2E6E3';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(userName || '보컬리스트', SHARE_WIDTH / 2, midY);

  // 음색 유형
  if (voiceType) {
    ctx.font = `400 40px 'Inter', 'Noto Sans KR', sans-serif`;
    ctx.fillStyle = '#A8D4B8';
    ctx.fillText(voiceType, SHARE_WIDTH / 2, midY + 90);
  }

  // 평균 음역 표시
  if (avgPitch !== null) {
    const noteLabel = pitchToNoteLabel(avgPitch);
    ctx.font = `300 32px 'Inter', sans-serif`;
    ctx.fillStyle = '#7A8A80';
    ctx.fillText(`평균 음역 ${noteLabel}`, SHARE_WIDTH / 2, midY + 150);
  }

  // 하단: 5축 수치 바
  const barSection = voiceType ? midY + 220 : midY + 180;
  const barX = 120;
  const barWidth = SHARE_WIDTH - barX * 2;
  const barSpacing = 80;

  axes.forEach((axis, i) => {
    const label = AXIS_LABELS[axis.key] ?? axis.label;
    drawAxisBar(ctx, label, axis.value, barX, barSection + i * barSpacing, barWidth);
  });

  // HLB 워터마크
  const watermarkY = SHARE_HEIGHT - 80;
  ctx.font = `600 28px 'Inter', sans-serif`;
  ctx.fillStyle = 'rgba(168,212,184,0.35)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HLB 보컬스튜디오 — vocalmind.app', SHARE_WIDTH / 2, watermarkY);

  return canvas;
}

function pitchToNoteLabel(hz: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = Math.round(12 * Math.log2(hz / 440) + 69);
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[((midi % 12) + 12) % 12];
  return `${note}${octave}`;
}
