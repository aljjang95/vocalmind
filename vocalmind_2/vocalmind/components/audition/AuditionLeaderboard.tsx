'use client';

import { Crown } from 'lucide-react';
import { useAuditionStore } from '@/stores/auditionStore';
import AudioPlayer from '@/components/shared/AudioPlayer';
import VoteButton from '@/components/community/VoteButton';
import type { AuditionEntry } from '@/types';
import styles from './AuditionLeaderboard.module.css';

const RANK_META: Record<number, { label: string; rankClass: string }> = {
  1: { label: '1위', rankClass: styles.rankGold },
  2: { label: '2위', rankClass: styles.rankSilver },
  3: { label: '3위', rankClass: styles.rankBronze },
};

interface EntryRowProps {
  entry: AuditionEntry;
  position: number; // 1-based index
  currentUserId: string | null;
  onVote: (id: string) => Promise<void>;
  onUnvote: (id: string) => Promise<void>;
  isMyEntry: boolean;
}

function EntryRow({
  entry,
  position,
  currentUserId,
  onVote,
  onUnvote,
  isMyEntry,
}: EntryRowProps) {
  const meta = RANK_META[position];
  const isTop3 = !!meta;

  return (
    <div
      className={`${styles.row} ${isTop3 ? `${styles.topRow} ${meta.rankClass}` : ''} ${isMyEntry ? styles.myRow : ''}`}
      aria-label={`${position}위 ${entry.author_name ?? '익명'}`}
    >
      {/* 순위 */}
      <div className={styles.rank}>
        {position === 1 ? (
          <Crown size={16} className={styles.crownGold} aria-label="1위" />
        ) : position === 2 ? (
          <Crown size={14} className={styles.crownSilver} aria-label="2위" />
        ) : position === 3 ? (
          <Crown size={14} className={styles.crownBronze} aria-label="3위" />
        ) : (
          <span className={styles.rankNum}>{position}</span>
        )}
      </div>

      {/* 아바타 */}
      <div className={styles.avatar} aria-hidden="true">
        {entry.author_avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.author_avatar_url}
            alt={entry.author_name ?? '아바타'}
            className={styles.avatarImg}
          />
        ) : (
          <div className={styles.avatarFallback}>
            {(entry.author_name ?? '?')[0].toUpperCase()}
          </div>
        )}
      </div>

      {/* 이름 + 내 항목 표시 */}
      <div className={styles.nameCol}>
        <span className={styles.name}>{entry.author_name ?? '익명'}</span>
        {isMyEntry && <span className={styles.meBadge}>나</span>}
      </div>

      {/* 오디오 미니 플레이어 */}
      <div className={styles.playerCol}>
        <AudioPlayer src={entry.audio_url} />
      </div>

      {/* 투표 수 + 버튼 */}
      <div className={styles.voteCol}>
        <VoteButton
          count={entry.vote_count}
          hasVoted={entry.has_voted ?? false}
          onVote={() => onVote(entry.id)}
          onUnvote={() => onUnvote(entry.id)}
          disabled={!currentUserId || isMyEntry}
        />
      </div>
    </div>
  );
}

interface AuditionLeaderboardProps {
  currentUserId: string | null;
  myEntryId: string | null;
}

export default function AuditionLeaderboard({ currentUserId, myEntryId }: AuditionLeaderboardProps) {
  const { entries, voteEntry, unvoteEntry } = useAuditionStore();

  if (entries.length === 0) {
    return (
      <section className={styles.leaderboard} aria-label="리더보드">
        <h2 className={styles.heading}>참가자 현황</h2>
        <div className={styles.empty}>
          <p>아직 참가자가 없습니다.</p>
          <p className={styles.emptySub}>첫 번째로 참가해보세요!</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.leaderboard} aria-label="리더보드">
      <h2 className={styles.heading}>참가자 현황</h2>

      <div className={styles.list} role="list">
        {entries.map((entry, index) => (
          <div key={entry.id} role="listitem">
            <EntryRow
              entry={entry}
              position={index + 1}
              currentUserId={currentUserId}
              onVote={voteEntry}
              onUnvote={unvoteEntry}
              isMyEntry={entry.id === myEntryId}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
