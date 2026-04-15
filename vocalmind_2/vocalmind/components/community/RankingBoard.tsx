'use client';

import { Crown, Medal } from 'lucide-react';
import type { CommunityPost } from '@/types';
import styles from './RankingBoard.module.css';

interface RankingBoardProps {
  posts: CommunityPost[];
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown size={16} className={styles.rankGold} />;
  if (rank === 2) return <Medal size={15} className={styles.rankSilver} />;
  if (rank === 3) return <Medal size={15} className={styles.rankBronze} />;
  return <span className={styles.rankNum}>{rank}</span>;
}

export default function RankingBoard({ posts }: RankingBoardProps) {
  const top5 = posts.slice(0, 5);
  if (top5.length === 0) return null;

  return (
    <div className={styles.board}>
      <h3 className={styles.title}>인기 TOP {top5.length}</h3>
      <ol className={styles.list}>
        {top5.map((post, idx) => {
          const rank = idx + 1;
          return (
            <li
              key={post.id}
              className={`${styles.item} ${rank <= 3 ? styles[`rank${rank}` as 'rank1' | 'rank2' | 'rank3'] : ''}`}
            >
              <div className={styles.rankIcon}>
                <RankIcon rank={rank} />
              </div>
              <div className={styles.info}>
                <span className={styles.authorName}>{post.author_name ?? '익명'}</span>
                {(post.song_title || post.song_artist) && (
                  <span className={styles.songName}>
                    {post.song_title}
                    {post.song_artist && ` — ${post.song_artist}`}
                  </span>
                )}
              </div>
              <div className={styles.votes}>
                <span className={styles.heartIcon}>♥</span>
                <span>{post.vote_count}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
