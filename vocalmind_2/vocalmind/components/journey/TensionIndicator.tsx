'use client';

import type { TensionData } from '@/lib/hooks/useRealtimeEval';

interface Props {
  tension: TensionData | null;
  feedback: string;
}

const AXIS_LABELS = [
  { key: 'laryngeal' as const, label: '후두', icon: '🫁' },
  { key: 'tongue_root' as const, label: '혀뿌리', icon: '👅' },
  { key: 'jaw' as const, label: '턱', icon: '🦷' },
  { key: 'register_break' as const, label: '성구전환', icon: '🎵' },
];

function barColor(value: number): string {
  if (value < 30) return '#10b981';
  if (value < 50) return '#eab308';
  if (value < 70) return '#f97316';
  return '#ef4444';
}

function overallColor(value: number): string {
  if (value < 30) return '#34d399';
  if (value < 50) return '#fbbf24';
  if (value < 70) return '#fb923c';
  return '#f87171';
}

export default function TensionIndicator({ tension, feedback }: Props) {
  if (!tension) {
    return (
      <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>녹음을 시작하면 실시간 분석이 시작됩니다</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 종합 긴장도 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>긴장도</span>
        <span style={{ fontSize: 24, fontWeight: 700, color: overallColor(tension.overall) }}>
          {Math.round(tension.overall)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {tension.detected ? '⚠️ 긴장 감지' : '✅ 이완'}
        </span>
      </div>

      {/* 4축 바 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {AXIS_LABELS.map(({ key, label, icon }) => {
          const value = tension[key];
          return (
            <div key={key} style={{ padding: 8, borderRadius: 6, background: 'var(--bg-elevated)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{icon} {label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{Math.round(value)}</span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    borderRadius: 999,
                    transition: 'all 0.5s',
                    background: barColor(value),
                    width: `${Math.min(value, 100)}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 감각 피드백 */}
      {feedback && (
        <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{feedback}</p>
        </div>
      )}
    </div>
  );
}
