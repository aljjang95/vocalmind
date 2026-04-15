'use client';

import { getNextStageProgress } from '@/lib/data/growthStages';
import styles from './GrowthProgress.module.css';

interface GrowthProgressProps {
  totalRecordingSec: number;
}

function formatSec(sec: number): string {
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

export default function GrowthProgress({ totalRecordingSec }: GrowthProgressProps) {
  const { currentStage, nextStage, progressPercent, remainingSec } =
    getNextStageProgress(totalRecordingSec);

  const isMaxed = nextStage === null;

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div className={styles.stageLabel}>
          <span className={styles.stageName}>{currentStage.name}</span>
          <span className={styles.stageBadge}>{currentStage.avatarLevel}</span>
        </div>
        <span className={styles.recordingTime}>
          {formatSec(totalRecordingSec)}
          {nextStage && ` / ${formatSec(nextStage.minRecordingSec)}`}
          {!isMaxed && ` (${progressPercent}%)`}
        </span>
      </div>

      <div className={styles.progressTrack}>
        <div
          className={`${styles.progressFill} ${isMaxed ? styles.maxed : ''}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {isMaxed ? (
        <p className={styles.maxedMsg}>최고 단계 달성! 완벽한 음색 복제가 가능합니다.</p>
      ) : (
        <div className={styles.nextInfo}>
          <span className={styles.nextLabel}>
            {nextStage!.name} 까지 {formatSec(remainingSec)} 남음
          </span>
          <div className={styles.nextUnlocks}>
            {nextStage!.unlocks.slice(0, 2).map((u) => (
              <span key={u} className={styles.unlockTag}>
                {u}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
