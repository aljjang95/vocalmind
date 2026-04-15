'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCommunityStore } from '@/stores/communityStore';
import FeedTabs from '@/components/community/FeedTabs';
import PostComposer from '@/components/community/PostComposer';
import PostCard from '@/components/community/PostCard';
import RankingBoard from '@/components/community/RankingBoard';
import type { FeedTab } from '@/types';
import styles from './CommunityClient.module.css';

export default function CommunityClient() {
  const { posts, tab, hasMore, isLoading, error, setTab, fetchPosts, loadMore } = useCommunityStore();
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const didInit = useRef(false);

  // 현재 로그인 사용자 확인
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id);
    });
  }, []);

  // 초기 로드
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    fetchPosts(true);
  }, [fetchPosts]);

  const handleTabChange = useCallback((newTab: FeedTab) => {
    setTab(newTab);
  }, [setTab]);

  // 무한 스크롤 IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>커뮤니티</h1>
        <p className={styles.subtitle}>보컬 커버를 공유하고 서로 응원해요</p>
      </div>

      <div className={styles.feedContainer}>
        <FeedTabs activeTab={tab} onChange={handleTabChange} />

        {/* 게시글 작성 (로그인 시) */}
        {currentUserId && <PostComposer />}

        {/* 인기 탭: 랭킹 보드 */}
        {tab === 'popular' && posts.length > 0 && (
          <RankingBoard posts={posts} />
        )}

        {/* 에러 상태 */}
        {error && (
          <div className={styles.errorBanner}>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => fetchPosts(true)}
              className={styles.retryBtn}
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 빈 상태 */}
        {!isLoading && !error && posts.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🎤</span>
            <p className={styles.emptyText}>
              {tab === 'battle' ? '배틀 게시글이 없습니다.' : '아직 게시글이 없습니다.'}
            </p>
            {currentUserId && (
              <p className={styles.emptyHint}>첫 번째 커버를 올려보세요!</p>
            )}
          </div>
        )}

        {/* 게시글 목록 */}
        <div className={styles.list}>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
            />
          ))}
        </div>

        {/* 로딩 스피너 */}
        {isLoading && (
          <div className={styles.loadingRow}>
            <div className={styles.spinner} />
          </div>
        )}

        {/* 무한 스크롤 sentinel */}
        <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />

        {/* 더 이상 없을 때 */}
        {!hasMore && posts.length > 0 && (
          <div className={styles.endText}>모든 게시글을 불러왔습니다.</div>
        )}
      </div>
    </div>
  );
}
