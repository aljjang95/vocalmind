'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useVocalDnaStore } from '@/stores/vocalDnaStore';

export default function VocalDnaWidget() {
  const dna = useVocalDnaStore((s) => s.dna);

  return (
    <Link
      href="/vocal-dna"
      style={{
        display: 'block',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-default)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Sparkles size={16} style={{ color: 'var(--accent)' }} />
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase' as const,
            color: 'var(--accent)',
          }}
        >
          음색 DNA
        </span>
      </div>

      {dna ? (
        <>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-h3)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              marginBottom: '6px',
            }}
          >
            {dna.voice_type ?? '분석 완료'}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {dna.avg_pitch_hz ? `평균 ${dna.avg_pitch_hz.toFixed(0)}Hz · ` : ''}안정도 {dna.tone_stability?.toFixed(0)}%
          </div>
        </>
      ) : (
        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          내 목소리를 분석해보세요
        </div>
      )}
    </Link>
  );
}
