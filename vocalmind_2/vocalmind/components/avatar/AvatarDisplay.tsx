'use client';

import Image from 'next/image';
import type { AvatarData, UserEquipped } from '@/types';
import styles from './AvatarDisplay.module.css';

export interface ResolvedLayers {
  bottomUrl?: string | null;    // z-index 2
  topUrl?: string | null;       // z-index 3
  hatUrl?: string | null;       // z-index 4
  accessoryUrl?: string | null; // z-index 5
  effectUrl?: string | null;    // z-index 6
}

interface Props {
  avatarUrl?: string | null;
  avatar?: AvatarData | null;
  equipped?: UserEquipped | null;
  resolvedLayers?: ResolvedLayers;
  size?: 'sm' | 'md' | 'lg';
}

export default function AvatarDisplay({
  avatarUrl,
  avatar,
  resolvedLayers,
  size = 'md',
}: Props) {
  const baseUrl = avatarUrl ?? avatar?.base_image_url ?? null;
  const sizeClass = styles[size];

  return (
    <div className={`${styles.container} ${sizeClass}`}>
      {baseUrl ? (
        <Image
          src={baseUrl}
          alt="내 아바타"
          fill
          className={`${styles.layer} ${styles.base}`}
          unoptimized
        />
      ) : (
        <div className={styles.placeholder}>
          <div className={styles.placeholderIcon}>&#127908;</div>
          {size !== 'sm' && <p>아바타를 생성해주세요</p>}
        </div>
      )}

      {resolvedLayers?.bottomUrl && (
        <Image
          src={resolvedLayers.bottomUrl}
          alt="하의"
          fill
          className={`${styles.layer} ${styles.bottom}`}
          unoptimized
        />
      )}
      {resolvedLayers?.topUrl && (
        <Image
          src={resolvedLayers.topUrl}
          alt="상의"
          fill
          className={`${styles.layer} ${styles.top}`}
          unoptimized
        />
      )}
      {resolvedLayers?.hatUrl && (
        <Image
          src={resolvedLayers.hatUrl}
          alt="모자"
          fill
          className={`${styles.layer} ${styles.hat}`}
          unoptimized
        />
      )}
      {resolvedLayers?.accessoryUrl && (
        <Image
          src={resolvedLayers.accessoryUrl}
          alt="액세서리"
          fill
          className={`${styles.layer} ${styles.accessory}`}
          unoptimized
        />
      )}
      {resolvedLayers?.effectUrl && (
        <Image
          src={resolvedLayers.effectUrl}
          alt="이펙트"
          fill
          className={`${styles.layer} ${styles.effect}`}
          unoptimized
        />
      )}
    </div>
  );
}
