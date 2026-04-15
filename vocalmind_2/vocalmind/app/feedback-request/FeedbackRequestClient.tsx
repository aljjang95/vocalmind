'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const MIN_SEC = 5;
const MAX_SEC = 60;
const MAX_CHARS = 1000;

export default function FeedbackRequestClient() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [concern, setConcern] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = async () => {
    setError(null);
    setAudioBlob(null);
    setFileName(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
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
          if (next >= MAX_SEC) {
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
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioBlob(file);
    setFileName(file.name);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!audioBlob) {
      setError('녹음 또는 파일을 업로드해주세요.');
      return;
    }
    if (!fileName && elapsed < MIN_SEC) {
      setError(`최소 ${MIN_SEC}초 이상 녹음해주세요.`);
      return;
    }
    if (concern.trim().length === 0) {
      setError('고민이나 요청사항을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, fileName ?? 'recording.webm');
      formData.append('concern', concern.trim());

      const res = await fetch('/api/feedback-request', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '신청에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${m}:${remainder.toString().padStart(2, '0')}`;
  };

  const hasAudio = audioBlob !== null && !isRecording;

  if (submitted) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] px-4 py-10 pb-20 sm:px-4 sm:py-10">
        <div className="max-w-[560px] mx-auto flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2">신청 완료</h1>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              녹음과 요청사항이 접수되었습니다. 선생님이 확인 후 피드백을 보내드립니다.
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-[var(--accent)] text-white rounded-lg px-4 py-3 font-semibold hover:bg-[var(--accent-hover)] transition-colors"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] px-3 py-6 pb-[60px] sm:px-4 sm:py-10 sm:pb-20">
      <div className="max-w-[560px] mx-auto flex flex-col gap-6">
        <div className="mb-4">
          <Link href="/pricing" className="text-[13px] text-[var(--text-muted)] no-underline">
            &larr; 요금제로 돌아가기
          </Link>
        </div>
        {/* 헤더 */}
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2">유료 피드백 신청</h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            녹음을 업로드하시면, 선생님이 직접 듣고 개인 맞춤 피드백을 보내드려요.
          </p>
        </div>

        {/* 안내 */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
          <div className="flex flex-col gap-4">
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">진행 과정</h3>
            <ol className="list-none p-0 m-0 flex flex-col gap-2.5">
              {[
                '녹음을 올리고 고민/요청사항을 작성해주세요',
                '신청이 완료되면 선생님에게 전달됩니다',
                '7년 경력 전문 트레이너가 직접 듣고 소견을 작성합니다',
                'AI 분석 + 선생님 소견을 비교한 맞춤 피드백을 받아보세요',
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  <span className="w-[22px] h-[22px] rounded-full bg-[rgba(99,102,241,0.15)] text-[var(--accent)] text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  {text}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* 녹음 영역 */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">목소리 녹음</p>

            <div className="flex flex-col items-center gap-3.5 py-6">
              <button
                type="button"
                className={`w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${
                  isRecording
                    ? 'border-red-500 bg-red-500/[0.08] animate-pulse'
                    : 'border-[var(--border-default)] bg-[var(--bg-elevated)] hover:border-[var(--accent)]'
                }`}
                onClick={isRecording ? stopRecording : startRecording}
                aria-label={isRecording ? '녹음 중지' : '녹음 시작'}
              >
                <div className={`bg-red-500 transition-all ${isRecording ? 'w-5 h-5 rounded' : 'w-7 h-7 rounded-full'}`} />
              </button>
              <span className={`font-mono text-base font-semibold ${isRecording ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
                {formatTime(elapsed)}
              </span>
              {isRecording && (
                <span className="text-xs text-[var(--text-muted)]">
                  {elapsed < MIN_SEC
                    ? `${MIN_SEC - elapsed}초 더 녹음해주세요`
                    : '중지 버튼을 눌러 완료하세요'}
                </span>
              )}
            </div>

            {hasAudio && (
              <p className="text-[13px] text-[var(--accent)] text-center">
                {fileName ?? `녹음 완료 (${elapsed}초)`}
              </p>
            )}

            <div className="flex items-center gap-3.5 text-[var(--text-muted)] text-xs before:content-[''] before:flex-1 before:h-px before:bg-[var(--border-subtle)] after:content-[''] after:flex-1 after:h-px after:bg-[var(--border-subtle)]">
              또는
            </div>

            <label className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg text-[var(--text-secondary)] text-[13px] cursor-pointer hover:border-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all self-center">
              파일 업로드
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isRecording}
              />
            </label>
          </div>
        </div>

        {/* 고민/요청사항 */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">고민 / 요청사항</p>
            <textarea
              className="w-full min-h-[120px] p-3.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-primary)] text-sm leading-relaxed resize-y font-[inherit] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              placeholder="고음에서 목이 잠기는 느낌이 있어요, 비브라토 연습 방법이 궁금해요 등 자유롭게 적어주세요."
              value={concern}
              onChange={(e) => setConcern(e.target.value.slice(0, MAX_CHARS))}
              maxLength={MAX_CHARS}
            />
            <span className="text-xs text-[var(--text-muted)] text-right">{concern.length} / {MAX_CHARS}</span>
          </div>
        </div>

        {/* 가격 + CTA */}
        <div className="flex flex-col gap-3 items-center pt-2">
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[28px] font-bold text-[var(--text-primary)] tracking-tight">50,000원</span>
            <span className="text-[13px] text-[var(--text-muted)]">/ 1회</span>
          </div>

          {error && <p className="text-[13px] text-red-500 text-center">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-[var(--accent)] text-white rounded-lg px-4 py-3 text-base font-semibold hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '신청 중...' : '피드백 신청하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
