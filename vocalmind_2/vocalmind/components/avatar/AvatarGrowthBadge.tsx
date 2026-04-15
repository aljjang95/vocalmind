'use client';

import { getCurrentStage } from '@/lib/data/growthStages';
import styles from './AvatarGrowthBadge.module.css';

interface AvatarGrowthBadgeProps {
  totalRecordingSec: number;
  /** 직접 avatarLevel 문자열을 전달할 때 */
  avatarLevel?: string;
}

const LEVEL_CLASS: Record<string, string> = {
  기본: styles['level-default'],
  초급: styles['level-beginner'],
  중급: styles['level-intermediate'],
  고급: styles['level-advanced'],
  마스터: styles['level-master'],
};

export default function AvatarGrowthBadge({
  totalRecordingSec,
  avatarLevel,
}: AvatarGrowthBadgeProps) {
  const level =
    avatarLevel ?? getCurrentStage(totalRecordingSec).avatarLevel;

  const levelClass = LEVEL_CLASS[level] ?? styles['level-default'];

  return (
    <span className={`${styles.badge} ${levelClass}`}>
      {level}
    </span>
  );
}
