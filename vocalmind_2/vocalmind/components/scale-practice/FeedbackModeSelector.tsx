'use client';

import { useScalePracticeStore } from '@/stores/scalePracticeStore';
import type { FeedbackMode } from '@/types';

const MODES: { value: FeedbackMode; icon: string; label: string; desc: string }[] = [
  { value: 'quiet', icon: '🤫', label: '조용히', desc: '연습 집중 · 끝나고 리포트' },
  { value: 'gentle', icon: '💬', label: '살짝', desc: '텍스트 피드백' },
  { value: 'active', icon: '🔊', label: '적극적', desc: 'AI 음성 코칭' },
];

export default function FeedbackModeSelector() {
  const { feedbackMode, setFeedbackMode } = useScalePracticeStore();

  return (
    <div style={{
      display: 'flex', gap: 8, justifyContent: 'center', padding: '8px 0',
    }}>
      {MODES.map((m) => {
        const active = feedbackMode === m.value;
        return (
          <button key={m.value} onClick={() => setFeedbackMode(m.value)} style={{
            flex: 1, maxWidth: 140, padding: '10px 8px', borderRadius: 12,
            border: active ? '1px solid rgba(217,119,6,0.4)' : '1px solid rgba(255,255,255,0.06)',
            background: active
              ? 'linear-gradient(135deg, rgba(217,119,6,0.15), rgba(217,119,6,0.05))'
              : 'rgba(255,255,255,0.02)',
            cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center' as const,
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{m.icon}</div>
            <div style={{
              fontSize: 12, fontWeight: 700, color: active ? 'var(--streak-gold)' : 'var(--text-secondary)',
              letterSpacing: '0.03em',
            }}>{m.label}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{m.desc}</div>
          </button>
        );
      })}
    </div>
  );
}
