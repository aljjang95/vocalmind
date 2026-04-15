'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuditionStore } from '@/stores/auditionStore';
import AuditionBanner from '@/components/audition/AuditionBanner';
import AuditionEntry from '@/components/audition/AuditionEntry';
import AuditionLeaderboard from '@/components/audition/AuditionLeaderboard';
import styles from './AuditionClient.module.css';

export default function AuditionClient() {
  const { event, entries, myEntry, isLoading, error, fetchEvent, fetchEntries } = useAuditionStore();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showEntry, setShowEntry] = useState(false);

  // 현재 로그인 사용자 확인
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  // 초기 로드 — 이벤트 + 참가자 목록 한번에
  useEffect(() => {
    fetchEvent().then(() => {
      fetchEntries();
    });
  }, [fetchEvent, fetchEntries]);

  const handleJoinClick = useCallback(() => {
    setShowEntry(true);
  }, []);

  // 이벤트 없음 상태
  if (!isLoading && !event && !error) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <div className={styles.emptyIcon} aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01"/>
            </svg>
          </div>
          <p className={styles.emptyTitle}>이번 주 오디션이 준비 중입니다</p>
          <p className={styles.emptySub}>곧 새로운 오디션이 시작됩니다. 다시 확인해 주세요!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* 로딩 */}
        {isLoading && !event && (
          <div className={styles.loading} aria-label="불러오는 중">
            <div className={styles.spinner} />
          </div>
        )}

        {/* 에러 */}
        {error && !event && (
          <div className={styles.errorBanner} role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => { fetchEvent().then(() => fetchEntries()); }}
              className={styles.retryBtn}
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 이벤트 + 콘텐츠 */}
        {event && (
          <>
            {/* 배너 */}
            <AuditionBanner
              event={event}
              entries={entries}
              myEntry={myEntry}
              onJoinClick={handleJoinClick}
              isLoggedIn={!!currentUserId}
            />

            {/* 참가 UI (로그인 + 미참가 + showEntry 시 표시) */}
            {currentUserId && !myEntry && showEntry && (
              <AuditionEntry />
            )}

            {/* 리더보드 */}
            <AuditionLeaderboard
              currentUserId={currentUserId}
              myEntryId={myEntry?.id ?? null}
            />
          </>
        )}
      </div>
    </div>
  );
}
