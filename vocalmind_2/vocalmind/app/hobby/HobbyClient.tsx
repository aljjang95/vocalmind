'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import UpsellBanner from '@/components/hobby/UpsellBanner';
import Nav from '@/components/shared/Nav';

type FeedbackState = {
  score: number;
  pitchAccuracy: number;
  toneStability: number;
  feedback: string;
  tensionDetected: boolean;
} | null;

export default function HobbyClient() {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [evaluating, setEvaluating] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }, []);

  const startRecording = async () => {
    setError(null);
    setAudioBlob(null);
    setFileName(null);
    setFeedback(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm',
      });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
        cleanup();
      };

      recorder.start(250);
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          if (prev + 1 >= 120) { recorderRef.current?.stop(); setIsRecording(false); }
          return prev + 1;
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
    if (file.size > 10 * 1024 * 1024) { setError('10MB 이하 파일만 가능합니다.'); return; }
    setAudioBlob(file);
    setFileName(file.name);
    setFeedback(null);
    setError(null);
  };

  const handleEvaluate = async () => {
    if (!audioBlob) return;
    setEvaluating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, fileName ?? 'recording.webm');
      formData.append('stage_id', '0');

      const res = await fetch('/api/evaluate', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFeedback(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '평가에 실패했습니다.');
    } finally {
      setEvaluating(false);
    }
  };

  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  return (
    <>
      <Nav />
      <div className="max-w-[680px] mx-auto px-5 pt-24 pb-16">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">자유 곡 연습</h1>
        <p className="text-[var(--text-secondary)] text-[0.9rem] mb-8 leading-relaxed">
          좋아하는 노래를 부르고 AI 피드백을 받아보세요. 녹음하거나 파일을 업로드하면 실시간으로 분석합니다.
        </p>

        {/* 녹음 영역 */}
        <div className="flex flex-col items-center gap-4 p-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] mb-6">
          <button
            type="button"
            className={`w-20 h-20 rounded-full border-[3px] flex items-center justify-center cursor-pointer transition-all duration-300 ${
              isRecording
                ? 'border-red-500 bg-red-500/10 animate-pulse'
                : 'border-[var(--border-subtle)] bg-[var(--bg-base)] hover:border-[var(--accent)]'
            }`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={evaluating}
          >
            <div className={`transition-all duration-200 bg-red-500 ${isRecording ? 'w-5 h-5 rounded' : 'w-7 h-7 rounded-full'}`} />
          </button>

          <span className={`font-mono text-lg font-semibold ${isRecording ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
            {formatTime(elapsed)}
          </span>

          {isRecording && (
            <span className="text-xs text-[var(--text-muted)]">
              {elapsed < 5 ? `${5 - elapsed}초 더 녹음해주세요` : '중지 버튼을 눌러 완료하세요'}
            </span>
          )}

          <div className="flex items-center gap-4 w-full text-[var(--text-muted)] text-xs before:content-[''] before:flex-1 before:h-px before:bg-[var(--border-subtle)] after:content-[''] after:flex-1 after:h-px after:bg-[var(--border-subtle)]">
            또는
          </div>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-secondary)] text-sm cursor-pointer hover:border-[var(--accent)]/30 transition-colors">
            파일 업로드 (mp3, wav, m4a)
            <input type="file" accept=".mp3,.wav,.m4a,.webm,audio/*" onChange={handleFileUpload} className="hidden" disabled={isRecording || evaluating} />
          </label>

          {audioBlob && !isRecording && (
            <p className="text-sm text-[var(--accent-light)]">
              {fileName ?? `녹음 완료 (${elapsed}초)`}
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        {audioBlob && !isRecording && (
          <Button variant="default" size="lg" className="w-full mb-6" onClick={handleEvaluate} disabled={evaluating}>
            {evaluating ? 'AI 분석 중...' : 'AI 평가 받기'}
          </Button>
        )}

        {/* 피드백 결과 */}
        {feedback && (
          <div className="p-6 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.03] mb-6 animate-[fadeIn_0.3s_ease-out]">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">AI 피드백</h3>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-[var(--accent-light)]">{feedback.score}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">종합 점수</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-[var(--text-primary)]">{feedback.pitchAccuracy}%</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">음정 정확도</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-[var(--text-primary)]">{feedback.toneStability}%</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">톤 안정성</div>
              </div>
            </div>
            {feedback.tensionDetected && (
              <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2 mb-3">
                긴장이 감지되었습니다. 이완 연습을 추천합니다.
              </div>
            )}
            <p className="text-[0.88rem] text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">{feedback.feedback}</p>
          </div>
        )}

        <UpsellBanner />
      </div>
    </>
  );
}
