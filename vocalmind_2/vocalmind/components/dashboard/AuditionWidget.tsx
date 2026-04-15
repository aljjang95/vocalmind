'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { useAuditionStore } from '@/stores/auditionStore';
import AuditionTimer from '@/components/audition/AuditionTimer';

export default function AuditionWidget() {
  const event = useAuditionStore((s) => s.event);
  const fetchEvent = useAuditionStore((s) => s.fetchEvent);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  if (!event) return null;

  return (
    <Link
      href="/audition"
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
        <Trophy size={16} style={{ color: 'var(--rank-gold)' }} />
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase' as const,
            color: 'var(--accent)',
          }}
        >
          이번 주 오디션
        </span>
      </div>

      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--fs-h3)',
          color: 'var(--text-primary)',
          fontWeight: 600,
          marginBottom: '8px',
        }}
      >
        {event.song_title} — {event.song_artist}
      </div>

      <AuditionTimer weekEnd={event.week_end} compact />
    </Link>
  );
}
