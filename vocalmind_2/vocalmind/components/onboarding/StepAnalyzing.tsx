'use client';

import { useState, useEffect } from 'react';

const PHASES = [
  { label: '음성 파일을 처리하고 있어요', icon: '🎙️' },
  { label: '음성 특성을 분석하고 있어요', icon: '📊' },
  { label: '긴장도를 측정하고 있어요', icon: '🔍' },
  { label: 'AI 상담 결과를 생성하고 있어요', icon: '🤖' },
];

export default function StepAnalyzing() {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const phaseInterval = setInterval(() => {
      setPhaseIndex((prev) => Math.min(prev + 1, PHASES.length - 1));
    }, 2500);
    return () => clearInterval(phaseInterval);
  }, []);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(dotInterval);
  }, []);

  const progress = ((phaseIndex + 1) / PHASES.length) * 100;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-8 text-center animate-[fadeIn_0.5s_ease-out]">
      {/* 파형 애니메이션 */}
      <div className="flex items-end gap-[3px] h-16">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full bg-[var(--accent)] opacity-60"
            style={{
              height: `${20 + Math.sin((Date.now() / 300 + i * 0.5)) * 30}%`,
              animation: `waveBar 1.2s ease-in-out ${i * 0.05}s infinite alternate`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes waveBar {
          0% { height: 15%; opacity: 0.3; }
          100% { height: 90%; opacity: 0.8; }
        }
      `}</style>

      <div>
        <h3 className="font-['Inter',sans-serif] text-[1.4rem] font-bold text-[var(--text-primary)] mb-2">
          AI가 목소리를 분석하고 있어요
        </h3>
        <p className="text-[0.88rem] text-[var(--text-secondary)]">
          약 10~15초 정도 소요됩니다{dots}
        </p>
      </div>

      {/* 프로그레스 바 */}
      <div className="w-full max-w-[360px]">
        <div className="h-1.5 bg-[var(--border-subtle)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--accent)] to-purple-500 rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 단계별 진행 */}
      <div className="flex flex-col gap-3 w-full max-w-[360px]">
        {PHASES.map(({ label, icon }, i) => (
          <div
            key={label}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-500 ${
              i === phaseIndex
                ? 'bg-[var(--accent)]/[0.08] border border-[var(--accent)]/20'
                : i < phaseIndex
                ? 'opacity-60'
                : 'opacity-30'
            }`}
          >
            <span className="text-base">{i < phaseIndex ? '✓' : icon}</span>
            <span
              className={`text-[0.82rem] ${
                i === phaseIndex
                  ? 'text-[var(--accent-light)] font-semibold'
                  : i < phaseIndex
                  ? 'text-[var(--text-secondary)] line-through'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
