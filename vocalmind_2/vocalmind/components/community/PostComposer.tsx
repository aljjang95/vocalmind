'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useCommunityStore } from '@/stores/communityStore';
import type { PostType } from '@/types';
import styles from './PostComposer.module.css';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_REC_SEC = 60;

const TYPE_OPTIONS: { value: PostType; label: string }[] = [
  { value: 'cover', label: '커버' },
  { value: 'free', label: '자유' },
  { value: 'battle', label: '배틀' },
];

interface PostComposerProps {
  onPosted?: () => void;
}

export default function PostComposer({ onPosted }: PostComposerProps) {
  const { createPost } = useCommunityStore();

  const [expanded, setExpanded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [postType, setPostType] = useState<PostType>('cover');
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const startRecording = async () => {
    setError(null);
    setAudioBlob(null);
    setFileName(null);
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
      recorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError('파일 크기는 20MB 이하만 가능합니다.');
      return;
    }
    setAudioBlob(file);
    setFileName(file.name);
    setError(null);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!audioBlob) {
      setError('오디오를 녹음하거나 파일을 업로드해주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, fileName ?? 'recording.webm');
      formData.append('type', postType);
      if (songTitle.trim()) formData.append('song_title', songTitle.trim());
      if (songArtist.trim()) formData.append('song_artist', songArtist.trim());
      if (description.trim()) formData.append('description', description.trim());

      await createPost(formData);

      // 초기화
      setAudioBlob(null);
      setFileName(null);
      setElapsed(0);
      setSongTitle('');
      setSongArtist('');
      setDescription('');
      setExpanded(false);
      onPosted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '게시에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setExpanded(true)}
      >
        <span className={styles.triggerIcon}>+</span>
        <span>커버를 올려보세요</span>
      </button>
    );
  }

  return (
    <div className={styles.composer}>
      <div className={styles.composerHeader}>
        <h3 className={styles.composerTitle}>새 게시글</h3>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={() => setExpanded(false)}
          aria-label="닫기"
        >
          ✕
        </button>
      </div>

      {/* 타입 선택 */}
      <div className={styles.typeSelector}>
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.typeBtn} ${postType === opt.value ? styles.typeActive : ''}`}
            onClick={() => setPostType(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 녹음 */}
      <div className={styles.recordSection}>
        <button
          type="button"
          className={`${styles.recBtn} ${isRecording ? styles.recActive : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={submitting}
          aria-label={isRecording ? '녹음 중지' : '녹음 시작'}
        >
          <div className={`${styles.recDot} ${isRecording ? styles.recDotActive : ''}`} />
        </button>
        <span className={`${styles.recTime} ${isRecording ? styles.recTimeActive : ''}`}>
          {formatTime(elapsed)}
        </span>
        {isRecording && (
          <span className={styles.recHint}>
            {elapsed < 3 ? '녹음 중...' : '중지 버튼을 눌러 완료'}
          </span>
        )}
        {audioBlob && !isRecording && (
          <span className={styles.recDone}>
            {fileName ?? `녹음 완료 (${elapsed}초)`}
          </span>
        )}
      </div>

      {/* 파일 업로드 */}
      <label className={styles.fileLabel}>
        <span>파일 업로드 (mp3, wav, m4a, webm)</span>
        <input
          type="file"
          accept=".mp3,.wav,.m4a,.webm,audio/*"
          onChange={handleFileUpload}
          className={styles.fileInput}
          disabled={isRecording || submitting}
        />
      </label>

      {/* 곡 정보 */}
      <div className={styles.fields}>
        <input
          type="text"
          placeholder="곡 제목"
          value={songTitle}
          onChange={(e) => setSongTitle(e.target.value)}
          className={styles.input}
          maxLength={100}
          disabled={submitting}
        />
        <input
          type="text"
          placeholder="아티스트"
          value={songArtist}
          onChange={(e) => setSongArtist(e.target.value)}
          className={styles.input}
          maxLength={80}
          disabled={submitting}
        />
        <textarea
          placeholder="한마디 (선택)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={styles.textarea}
          rows={2}
          maxLength={200}
          disabled={submitting}
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button
        type="button"
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={submitting || !audioBlob}
      >
        {submitting ? '업로드 중...' : '게시하기'}
      </button>
    </div>
  );
}
