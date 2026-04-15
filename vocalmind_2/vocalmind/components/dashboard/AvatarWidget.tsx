'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { User } from 'lucide-react';
import { useAvatarStore } from '@/stores/avatarStore';

export default function AvatarWidget() {
  const avatar = useAvatarStore((s) => s.avatar);
  const fetchAvatar = useAvatarStore((s) => s.fetchAvatar);

  useEffect(() => {
    fetchAvatar();
  }, [fetchAvatar]);

  return (
    <Link
      href="/avatar"
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
        <User size={16} style={{ color: 'var(--accent)' }} />
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            letterSpacing: '0.14em',
            textTransform: 'uppercase' as const,
            color: 'var(--accent)',
          }}
        >
          내 아바타
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {avatar?.base_image_url ? (
          <Image
            src={avatar.base_image_url}
            alt="아바타"
            width={48}
            height={48}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--bg-inset)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={24} style={{ color: 'var(--text-tertiary)' }} />
          </div>
        )}
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1rem',
              color: 'var(--text-primary)',
              fontWeight: 600,
            }}
          >
            {avatar?.base_image_url ? '아바타 꾸미기' : '아바타 만들기'}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            의상 · 배지 · 성장
          </div>
        </div>
      </div>
    </Link>
  );
}
