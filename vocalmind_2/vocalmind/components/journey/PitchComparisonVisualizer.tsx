'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { MelodyPoint } from '@/types';

interface StudentPitch {
  time: number;
  frequency: number;
}

interface Props {
  referencePitches: MelodyPoint[];
  studentPitches: StudentPitch[];
  isRecording: boolean;
  duration: number; // 선생님 오디오 길이 (X축 범위)
}

const TEACHER_COLOR = '#4ade80';
const STUDENT_COLOR = '#E11D48';

function hzToY(hz: number, logMin: number, logMax: number, height: number): number {
  if (hz <= 0) return height;
  const logHz = Math.log2(Math.max(hz, 2 ** logMin));
  const ratio = (logHz - logMin) / (logMax - logMin);
  return height - ratio * height;
}

/**
 * 세미톤 정규화: 선생님과 학생의 평균 피치 차이를 세미톤(키) 단위로 계산하여
 * 선생님 곡선을 학생 음역대에 맞게 시프트.
 * 예: 남자 선생님 + 여자 학생 → 보통 +4~5키 시프트
 * 2세미톤 이하 차이는 시프트 안 함 (같은 음역대)
 */
function calcSemitoneShift(refPitches: MelodyPoint[], studentPitches: StudentPitch[]): number {
  const refValid = refPitches.filter(p => p.frequency > 0).map(p => p.frequency);
  const stuValid = studentPitches.filter(p => p.frequency > 0).map(p => p.frequency);
  if (refValid.length === 0 || stuValid.length < 3) return 0; // 학생 데이터 최소 3개

  const refAvg = refValid.reduce((a, b) => a + b, 0) / refValid.length;
  const stuAvg = stuValid.reduce((a, b) => a + b, 0) / stuValid.length;

  // 세미톤 차이 (12 * log2 비율, 반올림)
  const semitoneDiff = Math.round(12 * Math.log2(stuAvg / refAvg));

  // 2키 이하 차이는 무시 (같은 음역대로 간주)
  if (Math.abs(semitoneDiff) <= 2) return 0;
  return semitoneDiff;
}

export default function PitchComparisonVisualizer({
  referencePitches,
  studentPitches,
  isRecording,
  duration,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

    ctx.clearRect(0, 0, displayW, displayH);

    // 키 정규화 (남자 선생님 + 여자 학생 대응)
    const semitoneShift = calcSemitoneShift(referencePitches, studentPitches);
    const shiftMultiplier = Math.pow(2, semitoneShift / 12); // 예: +5키 = 2^(5/12)배

    // Y축 범위 결정 (시프트된 선생님 + 학생 전체)
    const allFreqs: number[] = [];
    for (const p of referencePitches) {
      if (p.frequency > 0) allFreqs.push(p.frequency * shiftMultiplier);
    }
    for (const p of studentPitches) {
      if (p.frequency > 0) allFreqs.push(p.frequency);
    }
    if (allFreqs.length === 0) return;

    const minHz = Math.max(60, Math.min(...allFreqs) * 0.8);
    const maxHz = Math.min(1200, Math.max(...allFreqs) * 1.2);
    const logMin = Math.log2(minHz);
    const logMax = Math.log2(maxHz);

    // X축: 시간 → 픽셀
    const totalTime = Math.max(duration, 1);
    const timeToX = (t: number) => (t / totalTime) * displayW;

    // 세미톤 가이드 라인
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    for (let midi = 36; midi <= 84; midi++) {
      const hz = 440 * Math.pow(2, (midi - 69) / 12);
      if (hz < minHz || hz > maxHz) continue;
      const y = hzToY(hz, logMin, logMax, displayH);
      const note = NOTE_NAMES[midi % 12];
      const isNatural = !note.includes('#');
      ctx.strokeStyle = isNatural ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(displayW, y);
      ctx.stroke();
      if (isNatural) {
        const octave = Math.floor(midi / 12) - 1;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillText(`${note}${octave}`, 4, y - 3);
      }
    }

    // 선생님 곡선 (연속 라인, 초록) — 옥타브 시프트 적용
    ctx.beginPath();
    ctx.strokeStyle = TEACHER_COLOR;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    let started = false;
    for (const p of referencePitches) {
      if (p.frequency <= 0) { started = false; continue; }
      const x = timeToX(p.time);
      const y = hzToY(p.frequency * shiftMultiplier, logMin, logMax, displayH);
      if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();

    // 선생님 곡선 글로우
    ctx.strokeStyle = 'rgba(74,222,128,0.12)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    started = false;
    for (const p of referencePitches) {
      if (p.frequency <= 0) { started = false; continue; }
      const x = timeToX(p.time);
      const y = hzToY(p.frequency * shiftMultiplier, logMin, logMax, displayH);
      if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();

    // 학생 곡선 (점 + 라인, 로즈)
    if (studentPitches.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = STUDENT_COLOR;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      started = false;
      for (const p of studentPitches) {
        if (p.frequency <= 0) { started = false; continue; }
        const x = timeToX(p.time);
        const y = hzToY(p.frequency, logMin, logMax, displayH);
        if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
      }
      ctx.stroke();

      // 학생 점
      for (const p of studentPitches) {
        if (p.frequency <= 0) continue;
        const x = timeToX(p.time);
        const y = hzToY(p.frequency, logMin, logMax, displayH);
        ctx.fillStyle = STUDENT_COLOR;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 범례
    const legendY = displayH - 12;
    ctx.font = '11px sans-serif';
    // 선생님 (키 시프트 표시)
    const shiftLabel = semitoneShift !== 0
      ? `선생님 (${semitoneShift > 0 ? '+' : ''}${semitoneShift}키)`
      : '선생님';
    ctx.fillStyle = TEACHER_COLOR;
    ctx.fillRect(displayW - 190, legendY - 6, 12, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'left';
    ctx.fillText(shiftLabel, displayW - 174, legendY);
    // 학생
    ctx.fillStyle = STUDENT_COLOR;
    ctx.fillRect(displayW - 80, legendY - 6, 12, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('나', displayW - 64, legendY);
  }, [referencePitches, studentPitches, duration]);

  useEffect(() => {
    if (!isRecording) {
      draw(); // 정지 후 최종 렌더
      return;
    }
    const tick = () => {
      draw();
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isRecording, draw]);

  // 데이터 변경 시 정적 리드로
  useEffect(() => {
    if (!isRecording) draw();
  }, [isRecording, referencePitches, studentPitches, draw]);

  return (
    <div className="relative overflow-hidden rounded-lg bg-black/30 min-h-[220px] border border-white/[0.08]">
      <canvas ref={canvasRef} className="block w-full h-full min-h-[220px]" />
    </div>
  );
}
