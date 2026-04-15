'use client';

import type { AuditionEntry, AuditionEvent } from '@/types';
import AuditionTimer from './AuditionTimer';
import styles from './AuditionBanner.module.css';

interface AuditionBannerProps {
  event: AuditionEvent;
  entries: AuditionEntry[];
  myEntry: AuditionEntry | null;
  onJoinClick: () => void;
  isLoggedIn: boolean;
}

export default function AuditionBanner({
  event,
  entries,
  myEntry,
  onJoinClick,
  isLoggedIn,
}: AuditionBannerProps) {
  const totalVotes = entries.reduce((sum, e) => sum + e.vote_count, 0);
  const entrantCount = entries.length;

  return (
    <section className={styles.banner} aria-label="이번 주 오디션">
      <div className={styles.kicker}>이번 주 오디션</div>

      <div className={styles.songInfo}>
        <span className={styles.songTitle}>&ldquo;{event.song_title}&rdquo;</span>
        <span className={styles.songSep}> — </span>
        <span className={styles.songArtist}>{event.song_artist}</span>
      </div>

      {event.description && (
        <p className={styles.description}>{event.description}</p>
      )}

      <div className={styles.countdownRow}>
        <span className={styles.countdownLabel}>마감까지</span>
        <AuditionTimer weekEnd={event.week_end} />
      </div>

      <div className={styles.stats}>
        <span>참가자 <strong>{entrantCount}</strong>명</span>
        <span className={styles.statDivider}>|</span>
        <span>총 투표 <strong>{totalVotes}</strong></span>
      </div>

      <div className={styles.actions}>
        {myEntry ? (
          <div className={styles.enteredBadge} role="status">
            참가 완료
          </div>
        ) : (
          <button
            type="button"
            className={`btn-primary ${styles.joinBtn}`}
            onClick={onJoinClick}
            disabled={!isLoggedIn}
            title={!isLoggedIn ? '로그인이 필요합니다' : undefined}
          >
            {isLoggedIn ? '참가하기' : '로그인 후 참가'}
          </button>
        )}
      </div>
    </section>
  );
}
