'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useVocalDnaStore } from '@/stores/vocalDnaStore';
import { useAvatarStore } from '@/stores/avatarStore';
import DnaCanvas from '@/components/vocal-dna/DnaCanvas';
import AvatarDisplay from '@/components/avatar/AvatarDisplay';

export default function UserProfileCard() {
  const dna = useVocalDnaStore((s) => s.dna);
  const getDnaAxes = useVocalDnaStore((s) => s.getDnaAxes);
  const fetchDna = useVocalDnaStore((s) => s.fetchDna);
  const avatar = useAvatarStore((s) => s.avatar);
  const fetchAvatar = useAvatarStore((s) => s.fetchAvatar);

  useEffect(() => {
    fetchDna();
    fetchAvatar();
  }, [fetchDna, fetchAvatar]);

  const axes = dna ? getDnaAxes() : [];

  return (
    <div
      style={{
        background: 'var(--bg-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}
    >
      {avatar ? (
        <AvatarDisplay avatarUrl={avatar.base_image_url} size="sm" />
      ) : (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
          }}
        >
          ?
        </div>
      )}

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            내 프로필
          </span>
          {dna && (
            <DnaCanvas axes={axes} mini />
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <Link
            href="/vocal-dna"
            style={{
              fontSize: '0.75rem',
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            {dna ? '음색 DNA 보기' : 'DNA 분석하기'}
          </Link>
          <Link
            href="/avatar"
            style={{
              fontSize: '0.75rem',
              color: 'var(--accent)',
              textDecoration: 'none',
            }}
          >
            {avatar ? '아바타 꾸미기' : '아바타 만들기'}
          </Link>
        </div>
      </div>
    </div>
  );
}
