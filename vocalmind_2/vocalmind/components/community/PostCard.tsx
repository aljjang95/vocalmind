'use client';

import { useState } from 'react';
import { Trash2, Music, Play } from 'lucide-react';
import type { CommunityPost } from '@/types';
import { useCommunityStore } from '@/stores/communityStore';
import AudioPlayer from '@/components/shared/AudioPlayer';
import VoteButton from './VoteButton';
import styles from './PostCard.module.css';

interface PostCardProps {
  post: CommunityPost;
  currentUserId?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

const TYPE_LABEL: Record<string, string> = {
  cover: '커버',
  battle: '배틀',
  free: '자유',
};

export default function PostCard({ post, currentUserId }: PostCardProps) {
  const { votePost, unvotePost, deletePost } = useCommunityStore();
  const [deleting, setDeleting] = useState(false);
  const [playCount, setPlayCount] = useState(post.play_count);

  const isOwner = currentUserId === post.user_id;

  const handlePlay = async () => {
    setPlayCount((c) => c + 1);
    // play_count 서버 업데이트 (fire and forget)
    fetch(`/api/community/${post.id}/play`, { method: 'POST' }).catch(() => null);
  };

  const handleDelete = async () => {
    if (!confirm('게시글을 삭제하시겠습니까?')) return;
    setDeleting(true);
    try {
      await deletePost(post.id);
    } catch {
      setDeleting(false);
    }
  };

  const initials = (post.author_name ?? '익명').charAt(0).toUpperCase();

  return (
    <article className={styles.card}>
      {/* 프로필 헤더 */}
      <div className={styles.header}>
        <div className={styles.avatar}>
          {post.author_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.author_avatar_url} alt={post.author_name ?? '아바타'} className={styles.avatarImg} />
          ) : (
            <span className={styles.avatarInitials}>{initials}</span>
          )}
        </div>
        <div className={styles.authorInfo}>
          <span className={styles.authorName}>{post.author_name ?? '익명'}</span>
          <span className={styles.meta}>
            <span className={styles.typeTag}>{TYPE_LABEL[post.type] ?? post.type}</span>
            <span>{timeAgo(post.created_at)}</span>
          </span>
        </div>
        {isOwner && (
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={handleDelete}
            disabled={deleting}
            aria-label="게시글 삭제"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* 곡 정보 */}
      {(post.song_title || post.song_artist) && (
        <div className={styles.songInfo}>
          <Music size={13} className={styles.songIcon} />
          <span>
            {post.song_title}
            {post.song_artist && <span className={styles.artist}> — {post.song_artist}</span>}
          </span>
        </div>
      )}

      {/* 오디오 플레이어 */}
      {post.audio_url ? (
        <div className={styles.playerWrapper}>
          <AudioPlayer src={post.audio_url} onPlay={handlePlay} />
        </div>
      ) : (
        <div className={styles.noAudio}>
          <Play size={14} />
          <span>오디오 준비 중</span>
        </div>
      )}

      {/* 설명 */}
      {post.description && (
        <p className={styles.description}>{post.description}</p>
      )}

      {/* 하단 액션 */}
      <div className={styles.footer}>
        <VoteButton
          count={post.vote_count}
          hasVoted={post.has_voted ?? false}
          onVote={() => votePost(post.id)}
          onUnvote={() => unvotePost(post.id)}
          disabled={!currentUserId}
        />
        <span className={styles.playCount}>
          <Play size={12} />
          {playCount}
        </span>
      </div>
    </article>
  );
}
