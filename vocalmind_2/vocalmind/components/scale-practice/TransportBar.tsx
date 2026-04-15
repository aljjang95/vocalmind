'use client';

import { useScalePracticeStore } from '@/stores/scalePracticeStore';

interface Props {
  onPlay: () => void;
  onStop: () => void;
  onRecordToggle: () => void;
}

const iconBtn = (active: boolean, color: string, glow: string): React.CSSProperties => ({
  width: 52, height: 52, borderRadius: '50%', border: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 22, cursor: 'pointer', transition: 'all 0.2s ease',
  background: active
    ? `linear-gradient(135deg, ${color}, ${color}dd)`
    : 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
  boxShadow: active
    ? `0 4px 20px ${glow}, inset 0 1px 0 rgba(255,255,255,0.2)`
    : '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
  backdropFilter: 'blur(8px)',
});

export default function TransportBar({ onPlay, onStop, onRecordToggle }: Props) {
  const { isPlaying, isRecording, metronomeOn, setMetronomeOn, currentTranspose, startNote } = useScalePracticeStore();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
      padding: '12px 0',
    }}>
      {/* 재생 */}
      <button onClick={isPlaying ? onStop : onPlay} style={iconBtn(isPlaying, '#d97706', 'rgba(217,119,6,0.4)')}>
        {isPlaying ? '⏹' : '▶'}
      </button>

      {/* 녹음 */}
      <button
        onClick={onRecordToggle}
        style={{
          ...iconBtn(isRecording, '#dc2626', 'rgba(220,38,38,0.4)'),
          animation: isRecording ? 'pulse-glow 1.5s ease infinite' : 'none',
        }}
      >
        ⏺
      </button>

      {/* 메트로놈 */}
      <button onClick={() => setMetronomeOn(!metronomeOn)} style={iconBtn(metronomeOn, '#7c3aed', 'rgba(124,58,237,0.4)')}>
        🔔
      </button>

      {/* 현재 키 */}
      {isPlaying && (
        <div style={{
          padding: '6px 14px', borderRadius: 20,
          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)',
          fontSize: 13, color: 'var(--streak-gold)', fontWeight: 600,
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          letterSpacing: '0.05em',
        }}>
          {startNote} {currentTranspose >= 0 ? '+' : ''}{currentTranspose}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 4px 20px rgba(220,38,38,0.4), inset 0 1px 0 rgba(255,255,255,0.2); }
          50% { box-shadow: 0 4px 30px rgba(220,38,38,0.7), inset 0 1px 0 rgba(255,255,255,0.2); }
        }
      `}</style>
    </div>
  );
}
