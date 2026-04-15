'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCommunityStore } from '@/stores/communityStore';
import type { CommunityPost } from '@/types';
import AudioPlayer from '@/components/shared/AudioPlayer';
import VoteButton from '@/components/community/VoteButton';
import { Music, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import styles from './PostDetailClient.module.css';

interface PostDetailClientProps {
  postId: string;
}

export default function PostDetailClient({ postId }: PostDetailClientProps) {
  const { votePost, unvotePost } = useCommunityStore();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id);
    });
  }, []);

  const fetchPost = useCallback(async () => {
    try {
      const res = await fetch(`/api/community/${postId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? '게시글을 불러오지 못했습니다.');
      }
      const data = await res.json() as { post: CommunityPost };
      setPost(data.post);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const handleVote = async () => {
    if (!post) return;
    await votePost(post.id);
    setPost((p) => p ? { ...p, vote_count: p.vote_count + 1, has_voted: true } : p);
  };

  const handleUnvote = async () => {
    if (!post) return;
    await unvotePost(post.id);
    setPost((p) => p ? { ...p, vote_count: Math.max(0, p.vote_count - 1), has_voted: false } : p);
  };

  if (loading) {
    return (
      <div className={styles.centered}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className={styles.centered}>
        <p className={styles.errorText}>{error ?? '게시글을 찾을 수 없습니다.'}</p>
        <Link href="/community" className={styles.backLink}>커뮤니티로 돌아가기</Link>
      </div>
    );
  }

  const initials = (post.author_name ?? '익명').charAt(0).toUpperCase();

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <Link href="/community" className={styles.backBtn}>
          <ArrowLeft size={18} />
          <span>커뮤니티</span>
        </Link>
      </div>

      <article className={styles.article}>
        <div className={styles.header}>
          <div className={styles.avatar}>
            {post.author_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.author_avatar_url} alt="" className={styles.avatarImg} />
            ) : (
              <span className={styles.avatarInitials}>{initials}</span>
            )}
          </div>
          <div>
            <p className={styles.authorName}>{post.author_name ?? '익명'}</p>
            <p className={styles.postedAt}>
              {new Date(post.created_at).toLocaleDateString('ko-KR', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>
        </div>

        {(post.song_title || post.song_artist) && (
          <div className={styles.songInfo}>
            <Music size={14} className={styles.songIcon} />
            <span>
              {post.song_title}
              {post.song_artist && <span className={styles.artist}> — {post.song_artist}</span>}
            </span>
          </div>
        )}

        {post.audio_url && (
          <div className={styles.playerWrapper}>
            <AudioPlayer src={post.audio_url} />
          </div>
        )}

        {post.description && (
          <p className={styles.description}>{post.description}</p>
        )}

        <div className={styles.footer}>
          <VoteButton
            count={post.vote_count}
            hasVoted={post.has_voted ?? false}
            onVote={handleVote}
            onUnvote={handleUnvote}
            disabled={!currentUserId}
          />
        </div>
      </article>
    </div>
  );
}
