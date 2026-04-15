'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import styles from './VoteButton.module.css';

interface VoteButtonProps {
  count: number;
  hasVoted: boolean;
  onVote: () => Promise<void>;
  onUnvote: () => Promise<void>;
  disabled?: boolean;
}

export default function VoteButton({ count, hasVoted, onVote, onUnvote, disabled }: VoteButtonProps) {
  const [animating, setAnimating] = useState(false);

  const handleClick = async () => {
    if (disabled || animating) return;
    setAnimating(true);
    setTimeout(() => setAnimating(false), 400);

    if (hasVoted) {
      await onUnvote();
    } else {
      await onVote();
    }
  };

  return (
    <button
      type="button"
      className={`${styles.btn} ${hasVoted ? styles.voted : ''} ${animating ? styles.animating : ''}`}
      onClick={handleClick}
      disabled={disabled}
      aria-label={hasVoted ? '투표 취소' : '투표'}
    >
      <Heart
        size={16}
        className={styles.icon}
        fill={hasVoted ? 'currentColor' : 'none'}
        strokeWidth={hasVoted ? 0 : 1.8}
      />
      <span className={styles.count}>{count}</span>
    </button>
  );
}
