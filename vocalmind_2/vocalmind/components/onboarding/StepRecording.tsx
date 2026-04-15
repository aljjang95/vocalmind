'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { Button } from '@/components/ui/button';

const MIN_SEC = 5;
const MAX_SEC = 30;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_EXTS = ['.mp3', '.wav', '.m4a', '.webm'];

export default function StepRecording() {
  const { setStep, setAnalyzing, setError, setResult } = useOnboardingStore();

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);

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
    if (file.size > MAX_FILE_SIZE) {
      setError('파일 크기는 10MB 이하만 가능합니다.');
      return;
    }
    setAudioBlob(file);
    setFileName(file.name);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!audioBlob) return;
    if (!fileName && elapsed < MIN_SEC) {
      setError(`최소 ${MIN_SEC}초 이상 녹음해주세요.`);
      return;
    }

    setSubmitting(true);
    setStep(1);
    setAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, fileName ?? 'recording.webm');

      const res = await fetch('/api/onboarding-analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      setStep(2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '분석에 실패했습니다.';
      setError(msg);
      setStep(0);
    } finally {
      setAnalyzing(false);
      setSubmitting(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s_ = sec % 60;
    return `${m}:${s_.toString().padStart(2, '0')}`;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.type.startsWith('audio/') && !ACCEPTED_EXTS.some(ext => file.name.toLowerCase().endsWith(ext))) {
      setError('mp3, wav, m4a, webm 파일만 업로드 가능합니다.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('파일 크기는 10MB 이하만 가능합니다.');
      return;
    }
    setAudioBlob(file);
    setFileName(file.name);
    setError(null);
  }, [setError]);

  return (
    <div className="flex flex-col items-center gap-7 py-5 animate-[slideIn_0.4s_ease-out]">
      <h3 className="font-['Inter',sans-serif] text-[1.4rem] font-bold text-center">
        목소리를 들려주세요
      </h3>
      <p className="text-[0.9rem] text-[var(--text2)] text-center leading-relaxed max-w-[480px]">
        편하게 아무 노래나 한 소절 불러주세요. AI가 목소리 상태를 분석하고 맞춤 로드맵을 만들어드립니다.
      </p>

      {/* 음질 경고 배너 */}
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-amber-500/[0.08] border border-amber-500/20 text-amber-300 text-[0.82rem] max-w-[480px] w-full">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
          <path d="M8 1.5l6.5 12H1.5L8 1.5z" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M8 6.5v3M8 11.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        소음이 많거나 음질이 낮으면 정확한 분석이 어렵습니다. 조용한 환경에서 녹음해주세요.
      </div>

      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          className={`w-24 h-24 max-[560px]:w-20 max-[560px]:h-20 rounded-full border-[3px] flex items-center justify-center cursor-pointer transition-all duration-300 ${
            isRecording
              ? 'border-[var(--error)] bg-[rgba(239,68,68,0.1)] animate-[recPulse_1.5s_ease-in-out_infinite]'
              : 'border-[var(--border2)] bg-[var(--bg3)] hover:border-[var(--accent)] hover:bg-[rgba(59,130,246,0.08)]'
          }`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={submitting}
          aria-label={isRecording ? '녹음 중지' : '녹음 시작'}
        >
          <div
            className={`transition-all duration-200 bg-[var(--error)] ${
              isRecording ? 'w-6 h-6 rounded' : 'w-8 h-8 rounded-full'
            }`}
          />
        </button>
        <span
          className={`font-mono text-[1.1rem] font-semibold min-w-[60px] text-center ${
            isRecording ? 'text-[var(--error)]' : 'text-[var(--text2)]'
          }`}
        >
          {formatTime(elapsed)}
        </span>
        {isRecording && (
          <span className="text-[0.78rem] text-[var(--muted)] text-center">
            {elapsed < MIN_SEC
              ? `${MIN_SEC - elapsed}초 더 녹음해주세요`
              : '중지 버튼을 눌러 완료하세요'}
          </span>
        )}
      </div>

      {audioBlob && !isRecording && (
        <p className="text-[0.82rem] text-[var(--accent-lt)] text-center">
          {fileName ?? `녹음 완료 (${elapsed}초)`}
        </p>
      )}

      <div className="flex items-center gap-4 w-full max-w-[320px] text-[var(--muted)] text-[0.78rem] before:content-[''] before:flex-1 before:h-px before:bg-[var(--border)] after:content-[''] after:flex-1 after:h-px after:bg-[var(--border)]">
        또는
      </div>

      <label
        className={`w-full max-w-[400px] flex flex-col items-center gap-2 px-5 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
          dragging
            ? 'border-[var(--accent)] bg-[var(--accent)]/[0.05]'
            : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border2)]'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[var(--text-muted)]">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span className="text-[var(--text2)] text-[0.85rem]">
          파일을 드래그하거나 클릭해서 업로드
        </span>
        <span className="text-[var(--text-muted)] text-[0.75rem]">
          mp3, wav, m4a, webm · 최대 10MB
        </span>
        <input
          type="file"
          accept=".mp3,.wav,.m4a,.webm,audio/*"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isRecording || submitting}
        />
      </label>

      {audioBlob && !isRecording && (
        <Button
          variant="default"
          size="lg"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? '분석 중...' : '분석 시작'}
        </Button>
      )}
    </div>
  );
}
