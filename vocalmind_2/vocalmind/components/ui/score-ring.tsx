'use client';

import { motion } from 'framer-motion';
import { useCountUp } from '@/lib/hooks/useCountUp';

interface ScoreRingProps {
  score: number;
  passed?: boolean;
  label?: string;
  size?: number;
}

export function ScoreRing({
  score, passed, label = '점수', size = 120,
}: ScoreRingProps) {
  const { ref: countRef, value: displayScore } = useCountUp(score, 1200);
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 90
    ? 'var(--success)'
    : score >= 70
      ? 'var(--accent-light)'
      : score >= 40
        ? 'var(--warning)'
        : 'var(--error)';

  return (
    <div ref={countRef as React.RefObject<HTMLDivElement>} className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 8px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-[var(--text-primary)] font-mono">
            {displayScore}
          </span>
          {passed !== undefined && (
            <span className={`text-xs mt-0.5 ${
              passed ? 'text-[var(--success)]' : 'text-[var(--text-muted)]'
            }`}>
              {passed ? '통과' : '미통과'}
            </span>
          )}
        </div>
      </div>
      <span
        className="text-xs text-[var(--text-muted)] uppercase tracking-wider"
        style={{ textShadow: '0 0 12px rgba(80,180,120,0.3)' }}
      >
        {label}
      </span>
    </div>
  );
}
