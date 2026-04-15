'use client';

import { useState, useEffect } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { Button } from '@/components/ui/button';

function scoreColor(value: number): string {
  if (value <= 30) return 'var(--success)';
  if (value <= 60) return 'var(--warning)';
  return 'var(--error)';
}

function scoreLabel(value: number): string {
  if (value <= 20) return '매우 양호';
  if (value <= 40) return '양호';
  if (value <= 60) return '보통';
  if (value <= 80) return '긴장 감지';
  return '높은 긴장';
}

function scoreEmoji(value: number): string {
  if (value <= 30) return '✨';
  if (value <= 60) return '⚡';
  return '🔥';
}

/** SVG 레이더 차트 — 4축 긴장도 시각화 */
function RadarChart({ values }: { values: [number, number, number, number] }) {
  const labels = ['후두', '혀뿌리', '턱', '성구전환'];
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;

  const angleStep = (Math.PI * 2) / 4;
  const getPoint = (index: number, value: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const dist = (value / 100) * r;
    return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
  };

  const gridLevels = [25, 50, 75, 100];
  const dataPoints = values.map((v, i) => getPoint(i, v));
  const pathD = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[220px] mx-auto">
      {/* 그리드 */}
      {gridLevels.map((level) => {
        const pts = Array.from({ length: 4 }, (_, i) => getPoint(i, level));
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
        return <path key={level} d={d} fill="none" stroke="var(--border-subtle)" strokeWidth="0.5" opacity="0.5" />;
      })}

      {/* 축 */}
      {Array.from({ length: 4 }, (_, i) => {
        const p = getPoint(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border-subtle)" strokeWidth="0.5" opacity="0.3" />;
      })}

      {/* 데이터 영역 */}
      <path
        d={pathD}
        fill="var(--accent)"
        fillOpacity="0.15"
        stroke="var(--accent)"
        strokeWidth="2"
        className="animate-[radarDraw_1s_ease-out_forwards]"
      />

      {/* 데이터 포인트 */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--accent)" className="animate-[fadeIn_0.5s_ease-out_forwards]" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}

      {/* 라벨 */}
      {labels.map((label, i) => {
        const p = getPoint(i, 120);
        return (
          <text key={label} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="var(--text-secondary)" className="font-sans">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

/** 카운트업 애니메이션 훅 */
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

export default function StepResult() {
  const { result, setStep } = useOnboardingStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const overallAnimated = useCountUp(result?.tension.overall ?? 0);
  const laryngealAnimated = useCountUp(result?.tension.laryngeal ?? 0, 1400);
  const tongueAnimated = useCountUp(result?.tension.tongue_root ?? 0, 1500);
  const jawAnimated = useCountUp(result?.tension.jaw ?? 0, 1600);
  const registerAnimated = useCountUp(result?.tension.register_break ?? 0, 1700);

  if (!result) return null;
  const { tension, consultation } = result;

  return (
    <div className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <h3 className="font-['Inter',sans-serif] text-[1.4rem] font-bold mb-2">분석 결과</h3>
      <p className="text-[0.9rem] text-[var(--text-secondary)] mb-7 leading-relaxed">
        AI가 목소리에서 감지한 긴장 상태입니다.
      </p>

      {/* 종합 점수 + 레이더 차트 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-7">
        {/* 종합 점수 카드 */}
        <div className="flex flex-col items-center justify-center p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl">
          <div className="text-[0.78rem] text-[var(--text-muted)] mb-2">종합 긴장도</div>
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                stroke={scoreColor(tension.overall)}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${(overallAnimated / 100) * 327} 327`}
                className="transition-[stroke-dasharray] duration-1000"
              />
            </svg>
            <div className="text-center">
              <span className="font-mono text-[2rem] font-bold" style={{ color: scoreColor(tension.overall) }}>
                {overallAnimated}
              </span>
            </div>
          </div>
          <div className="mt-2 text-sm font-medium" style={{ color: scoreColor(tension.overall) }}>
            {scoreEmoji(tension.overall)} {scoreLabel(tension.overall)}
          </div>
        </div>

        {/* 레이더 차트 */}
        <div className="flex items-center justify-center p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl">
          <RadarChart values={[tension.laryngeal, tension.tongue_root, tension.jaw, tension.register_break]} />
        </div>
      </div>

      {/* 부위별 상세 */}
      <div className="mb-7 space-y-3">
        <div className="text-[0.88rem] font-semibold text-[var(--text-secondary)] mb-1">부위별 긴장도</div>
        {[
          { label: '후두 긴장', value: tension.laryngeal, animated: laryngealAnimated },
          { label: '혀뿌리 긴장', value: tension.tongue_root, animated: tongueAnimated },
          { label: '턱 긴장', value: tension.jaw, animated: jawAnimated },
          { label: '성구전환', value: tension.register_break, animated: registerAnimated },
        ].map(({ label, value, animated }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-[0.82rem] text-[var(--text-secondary)] w-24 shrink-0">{label}</span>
            <div className="flex-1 h-2 bg-[var(--border-subtle)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-1000 ease-out"
                style={{ width: `${animated}%`, background: scoreColor(value) }}
              />
            </div>
            <span className="text-[0.82rem] font-mono font-semibold w-8 text-right" style={{ color: scoreColor(value) }}>
              {animated}
            </span>
          </div>
        ))}
      </div>

      {/* 발견된 문제점 */}
      {consultation.problems.length > 0 && (
        <div className="mb-7">
          <div className="text-[0.88rem] font-semibold text-[var(--text-secondary)] mb-3">발견된 문제점</div>
          <div className="flex flex-col gap-2.5">
            {consultation.problems.map((problem, i) => (
              <div
                key={i}
                className="flex items-start gap-3 px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <span className="shrink-0 w-5 h-5 rounded-full bg-red-500/15 text-red-400 text-[0.7rem] flex items-center justify-center mt-0.5 font-bold">
                  {i + 1}
                </span>
                <span className="text-[0.88rem] text-[var(--text-secondary)] leading-normal">{problem}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end mt-8">
        <Button variant="default" size="lg" onClick={() => setStep(3)}>
          맞춤 로드맵 보기
        </Button>
      </div>
    </div>
  );
}
