'use client';

import { useState, useEffect } from 'react';
import { useAuditionStore } from '@/stores/auditionStore';
import { useAudioRecorder } from '@/lib/hooks/useAudioRecorder';
import AudioPlayer from '@/components/shared/AudioPlayer';
import styles from './AuditionEntry.module.css';

const MIN_REC_SEC = 15;
const MAX_REC_SEC = 60;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${pad(s)}`;
}

export default function AuditionEntry() {
  const { submitEntry, myEntry, isLoading } = useAuditionStore();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    isRecording,
    elapsed,
    blob: audioBlob,
    start,
    stop,
    reset: resetRecording,
  } = useAudioRecorder({
    maxSeconds: MAX_REC_SEC,
    onError: (msg) => setError(msg),
  });

  // audioBlob이 변하면 preview URL 재생성 (이전 URL revoke)
  useEffect(() => {
    if (!audioBlob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  // myEntry가 설정되면 참가 완료 상태로 전환
  useEffect(() => {
    if (myEntry) setSubmitted(true);
  }, [myEntry]);

  const startRecording = async () => {
    setError(null);
    resetRecording();
    try {
      await start();
    } catch {
      // onError에서 처리
    }
  };

  const stopRecording = () => {
    if (isRecording && elapsed < MIN_REC_SEC) {
      setError(`최소 ${MIN_REC_SEC}초 이상 녹음해주세요. (현재 ${elapsed}초)`);
      return;
    }
    stop();
  };

  const handleSubmit = async () => {
    if (!audioBlob) {
      setError('먼저 녹음해주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await submitEntry(audioBlob);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '참가 신청에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    resetRecording();
    setError(null);
  };

  if (submitted || myEntry) {
    return (
      <div className={styles.completedBox} role="status">
        <div className={styles.completedIcon} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <p className={styles.completedTitle}>참가 완료!</p>
          <p className={styles.completedSub}>투표를 기다려주세요</p>
        </div>
      </div>
    );
  }

  return (
    <section className={styles.entryBox} aria-label="오디션 참가">
      <h2 className={styles.heading}>내 녹음 올리기</h2>
      <p className={styles.hint}>15~60초 녹음 후 참가하세요</p>

      {/* 녹음 버튼 */}
      <div className={styles.recordArea}>
        <button
          type="button"
          className={`${styles.recBtn} ${isRecording ? styles.recActive : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={submitting || isLoading || !!audioBlob}
          aria-label={isRecording ? '녹음 중지' : '녹음 시작'}
        >
          {isRecording && <span className={styles.recPulse} aria-hidden="true" />}
          <span className={styles.recDot} aria-hidden="true" />
        </button>

        <div className={styles.recordInfo}>
          {isRecording ? (
            <>
              <span className={styles.recStatus}>녹음 중</span>
              <span className={styles.recTime}>{formatTime(elapsed)}</span>
              <span className={styles.recMax}>/ {formatTime(MAX_REC_SEC)}</span>
            </>
          ) : audioBlob ? (
            <span className={styles.recDone}>녹음 완료 ({formatTime(elapsed)})</span>
          ) : (
            <span className={styles.recIdle}>버튼을 눌러 시작</span>
          )}
        </div>

        {/* 다시 녹음 */}
        {audioBlob && !isRecording && (
          <button
            type="button"
            className={styles.resetBtn}
            onClick={handleReset}
            disabled={submitting}
            aria-label="다시 녹음"
          >
            다시
          </button>
        )}
      </div>

      {/* 미리듣기 */}
      {previewUrl && !isRecording && (
        <div className={styles.preview}>
          <span className={styles.previewLabel}>미리듣기</span>
          <AudioPlayer src={previewUrl} />
        </div>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}

      {/* 참가하기 버튼 */}
      {audioBlob && !isRecording && (
        <button
          type="button"
          className={`btn-primary ${styles.submitBtn}`}
          onClick={handleSubmit}
          disabled={submitting || isLoading}
        >
          {submitting ? '참가 신청 중...' : '참가하기'}
        </button>
      )}
    </section>
  );
}
