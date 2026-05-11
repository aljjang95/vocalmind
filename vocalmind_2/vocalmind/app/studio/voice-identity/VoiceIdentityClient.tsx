'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAudioRecorder } from '@/lib/hooks/useAudioRecorder';

// 10문장 — 음소 다양성 + 한국어 음운 균형 (모음/자음/받침 분포)
const SENTENCES = [
  '안녕하세요, 저는 제 목소리로 노래를 불러보고 싶어요.',
  '아름다운 별빛 아래에서 조용히 숨을 고르고 있어요.',
  '오늘따라 햇살이 참 따뜻하게 느껴지는 하루네요.',
  '커피 한 잔을 앞에 두고 창밖을 바라보는 시간이 좋아요.',
  '바람이 불어오는 언덕에서 친구의 목소리가 들려왔어요.',
  '비 오는 밤거리를 혼자 걸으며 노래를 흥얼거렸어요.',
  '사랑은 가끔 서툴지만 그래서 더 진심으로 와닿는 법이죠.',
  '뜨거운 여름밤, 파도 소리에 심장이 함께 뛰고 있었어요.',
  '마음이 복잡할 땐 좋아하는 노래를 크게 틀어놓고 쉬어요.',
  '내일은 조금 더 용기를 내서 한 발짝 나아가 볼 거예요.',
];

type Props = {
  existingStatus: 'collecting' | 'training' | 'ready' | null;
  existingCount: number;
  existingId: string | null;
};

type ClipInfo = { storagePath: string; durationSec: number };
type PendingClip = { blob: Blob; url: string; durationSec: number };

export default function VoiceIdentityClient({ existingStatus, existingCount }: Props) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [clips, setClips] = useState<Record<number, ClipInfo>>({});
  const [pending, setPending] = useState<PendingClip | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pending URL 누수 방지 — 새 blob URL 생성 시 이전 것 revoke.
  const pendingRef = useRef<PendingClip | null>(null);
  pendingRef.current = pending;
  useEffect(() => {
    return () => {
      if (pendingRef.current) URL.revokeObjectURL(pendingRef.current.url);
    };
  }, []);

  const { isRecording, elapsed, start, stop, reset } = useAudioRecorder({
    maxSeconds: 12,
    onComplete: (blob) => {
      // 이전 pending이 있으면 URL 해제 후 새 pending으로 교체.
      if (pendingRef.current) URL.revokeObjectURL(pendingRef.current.url);
      const durationSec = Math.max(1, elapsed);
      setPending({ blob, url: URL.createObjectURL(blob), durationSec });
    },
    onError: (msg) => setError(msg),
  });

  const progress = Object.keys(clips).length;
  const done = progress >= SENTENCES.length;

  async function uploadClip(blob: Blob, durationSec: number) {
    setIsUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', blob, `voice-${idx + 1}.webm`);
      fd.append('kind', 'recording');
      const r = await fetch('/api/studio/upload', { method: 'POST', body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? '업로드 실패');
      setClips((prev) => ({
        ...prev,
        [idx]: { storagePath: data.storagePath, durationSec },
      }));
      if (pendingRef.current) URL.revokeObjectURL(pendingRef.current.url);
      setPending(null);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드 오류');
    } finally {
      setIsUploading(false);
    }
  }

  function useThisTake() {
    if (!pending) return;
    if (pending.durationSec < 2) {
      setError('녹음이 너무 짧아요. 문장을 처음부터 또박또박 읽어주세요.');
      return;
    }
    void uploadClip(pending.blob, pending.durationSec);
  }

  function discardPending() {
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
    reset();
  }

  function nextSentence() {
    discardPending();
    if (idx < SENTENCES.length - 1) setIdx(idx + 1);
  }

  function retry() {
    setClips((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    discardPending();
  }

  const submitting = useMemo(() => existingStatus === 'training', [existingStatus]);

  async function submit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const clipsArr = SENTENCES.map((_, i) => clips[i]).filter(Boolean);
      const r = await fetch('/api/voice-identity/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: clipsArr }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? '등록 실패');
      router.push('/studio');
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록 오류');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (existingStatus === 'ready') {
    return (
      <main className="mx-auto max-w-[720px] px-5 py-10">
        <Link href="/studio" className="mb-6 inline-block text-xs text-white/50 hover:text-white/80">
          ← 스튜디오 홈
        </Link>
        <header className="mb-6">
          <h1 className="text-[24px] font-extrabold text-white">음색 학습 완료</h1>
          <p className="mt-1 text-sm text-white/60">이미 등록된 음색 모델이 있어요. 바로 커버를 만들 수 있습니다.</p>
        </header>
        <Link
          href="/studio/new"
          className="inline-block rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400"
        >
          커버 만들러 가기
        </Link>
      </main>
    );
  }

  if (submitting) {
    return (
      <main className="mx-auto max-w-[720px] px-5 py-10">
        <Link href="/studio" className="mb-6 inline-block text-xs text-white/50 hover:text-white/80">
          ← 스튜디오 홈
        </Link>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-emerald-400" />
          <h2 className="text-lg font-bold text-white">음색 학습 중</h2>
          <p className="mt-2 text-sm text-white/60">
            녹음이 접수됐고 관리자 학습/승인 대기 중입니다. 승인 완료 후 커버 제작에 사용할 수 있어요.
          </p>
          <p className="mt-1 text-xs text-white/40">제출한 녹음: {existingCount}개</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[720px] px-5 py-10">
      <Link href="/studio" className="mb-6 inline-block text-xs text-white/50 hover:text-white/80">
        ← 스튜디오 홈
      </Link>

      <header className="mb-6">
        <h1 className="text-[24px] font-extrabold text-white">내 음색 등록</h1>
        <p className="mt-1 text-sm text-white/60">
          10개 문장을 또렷하게 녹음해주세요. 조용한 환경에서 평소 말투로 읽어주시면 돼요.
        </p>
      </header>

      <div className="mb-6 flex items-center justify-between text-xs text-white/50">
        <span>{progress} / {SENTENCES.length} 완료</span>
        <span>문장 {idx + 1}번</span>
      </div>

      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-emerald-400 transition-all"
          style={{ width: `${(progress / SENTENCES.length) * 100}%` }}
        />
      </div>

      <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-4 text-xs font-semibold text-emerald-300">이 문장을 읽어주세요</div>
        <p className="text-lg leading-relaxed text-white">{SENTENCES[idx]}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {!clips[idx] && !isRecording && !pending && (
            <button
              type="button"
              onClick={() => start().catch(() => {})}
              disabled={isUploading}
              className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              🎙 녹음 시작
            </button>
          )}
          {isRecording && (
            <button
              type="button"
              onClick={stop}
              className="rounded-lg bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-400"
            >
              ⏹ 녹음 종료 ({elapsed}s)
            </button>
          )}
          {clips[idx] && !isRecording && !pending && (
            <>
              <span className="text-sm text-emerald-300">✓ 완료 ({clips[idx].durationSec}s)</span>
              <button
                type="button"
                onClick={retry}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs text-white/70 hover:border-white/30"
              >
                다시 녹음
              </button>
              {idx < SENTENCES.length - 1 && (
                <button
                  type="button"
                  onClick={nextSentence}
                  className="ml-auto rounded-lg bg-white/10 px-4 py-2 text-xs text-white hover:bg-white/15"
                >
                  다음 문장 →
                </button>
              )}
            </>
          )}
          {isUploading && <span className="text-xs text-white/50">업로드 중...</span>}
        </div>

        {pending && !isRecording && !isUploading && (
          <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="mb-2 text-xs text-white/60">
              미리듣기 — {pending.durationSec}초. 소리가 또렷하면 사용해주세요.
            </div>
            <audio controls src={pending.url} className="w-full" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={useThisTake}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-400"
              >
                이 녹음 사용
              </button>
              <button
                type="button"
                onClick={discardPending}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs text-white/70 hover:border-white/30"
              >
                다시 녹음
              </button>
            </div>
          </div>
        )}
      </section>

      <nav className="mb-6 grid grid-cols-5 gap-2 text-[11px]">
        {SENTENCES.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { discardPending(); setIdx(i); }}
            className={`rounded-md py-2 transition-colors ${
              i === idx
                ? 'bg-emerald-500/20 text-emerald-200'
                : clips[i]
                ? 'bg-emerald-500/10 text-emerald-300/70'
                : 'bg-white/5 text-white/40 hover:bg-white/10'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      {error && (
        <div className="mb-4 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!done || isSubmitting}
        onClick={submit}
        className="w-full rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? '등록 중...' : done ? '음색 학습 시작' : `녹음 ${SENTENCES.length - progress}개 남음`}
      </button>

      <p className="mt-4 text-xs text-white/40">
        녹음 파일은 본인의 음색 모델 학습 용도로만 사용되며, 제3자에게 공유되지 않아요.
      </p>
    </main>
  );
}
