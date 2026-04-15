'use client';

import { motion } from 'framer-motion';

interface MetricBarProps {
  label: string;
  value: number;
  color?: string;
}

export function MetricBar({
  label, value, color = 'var(--accent)',
}: MetricBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className="text-[var(--text-primary)] font-mono font-medium">
          {Math.round(value)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 12px ${color}`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
