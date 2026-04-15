'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuditionStore } from '@/stores/auditionStore';
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

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // previewUrl cleanup
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // myEntry가 설정되면 참가 완료 상태로 전환
  useEffect(() => {
    if (myEntry) setSubmitted(true);
  }, [myEntry]);

  const startRecording = async () => {
    setError(null);
    setAudioBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        cleanup();
      };

      recorder.start(250);
      setIsRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= MAX_REC_SEC) {
            recorderRef.current?.stop();
            setIsRecording(false);
          }
          return next;
        });
      }, 1000);
    } catch {
      setError('마이크 권한을 허용해주세요.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') {
      if (elapsed < MIN_REC_SEC) {
        setError(`최소 ${MIN_REC_SEC}초 이상 녹음해주세요. (현재 ${elapsed}초)`);
        return;
      }
      recorderRef.current.stop();
      setIsRecording(false);
    }
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
    setAudioBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setElapsed(0);
    setError(null);
    setIsRecording(false);
    cleanup();
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
