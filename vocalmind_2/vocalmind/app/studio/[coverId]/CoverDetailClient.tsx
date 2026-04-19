'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useStudioJob } from '@/lib/hooks/useStudioJob';

interface Props {
  jobId: string;
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'refunded']);
const CANCELLABLE_STATUSES = new Set([
  'pending', 'vocal_separating', 'vocal_rvc', 'vocal_mixing', 'scene_planning',
]);

export default function CoverDetailClient({ jobId }: Props) {
  const { job, isLoading, error } = useStudioJob(jobId);

  if (isLoading) {
    return <Shell><div className="text-sm text-white/50">불러오는 중...</div></Shell>;
  }
  if (error || !job) {
    return (
      <Shell>
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-6 text-sm text-red-200">
          커버를 찾을 수 없어요. {error && `(${error})`}
        </div>
      </Shell>
    );
  }

  const isTerminal = TERMINAL_STATUSES.has(job.status);

  return (
    <Shell>
      <h1 className="mb-1 text-[22px] font-extrabold text-white">
        {job.title ?? '이름 없는 커버'}
      </h1>
      <p className="text-xs text-white/50">
        {new Date(job.createdAt).toLocaleString('ko-KR')} · {job.costCredits}크레딧
      </p>

      {!isTerminal && (
        <>
          <ProgressPanel
            progressPct={job.progressPct}
            label={job.currentStepLabel}
            status={job.status}
          />
          {CANCELLABLE_STATUSES.has(job.status) && (
            <CancelSection jobId={jobId} costCredits={job.costCredits} />
          )}
        </>
      )}

      {job.status === 'completed' && (
        <CompletedPanel
          landscapeUrl={job.landscapeUrl}
          portraitUrl={job.portraitUrl}
          thumbnailUrl={job.thumbnailUrl}
          c2paSigned={job.c2paSigned}
        />
      )}

      {(job.status === 'failed' || job.status === 'refunded') && (
        <FailurePanel
          failedStep={job.failedStep}
          lastError={job.lastError}
          costCredits={job.costCredits}
          refunded={job.status === 'refunded'}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[860px] px-5 py-10">
      <Link href="/studio" className="mb-6 inline-block text-xs text-white/50 hover:text-white/80">
        ← 스튜디오 홈
      </Link>
      {children}
    </main>
  );
}

function ProgressPanel({
  progressPct, label, status,
}: {
  progressPct: number;
  label: string | null;
  status: string;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-white">
          {label ?? status}
        </span>
        <span className="font-mono text-sm text-white/60">{progressPct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-emerald-400 transition-[width] duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p className="mt-4 text-xs text-white/50">
        이 페이지는 실시간으로 업데이트됩니다. 다른 화면으로 이동해도 됩니다.
      </p>
    </div>
  );
}

function CompletedPanel({
  landscapeUrl, portraitUrl, thumbnailUrl, c2paSigned,
}: {
  landscapeUrl: string | null;
  portraitUrl: string | null;
  thumbnailUrl: string | null;
  c2paSigned: boolean;
}) {
  const [orient, setOrient] = useState<'landscape' | 'portrait'>('landscape');
  const currentPath = orient === 'landscape' ? landscapeUrl : portraitUrl;
  const signedUrl = useSignedUrl(currentPath);
  const signedThumb = useSignedUrl(thumbnailUrl);

  return (
    <div className="mt-6">
      <div className="mb-3 flex gap-2">
        {(['landscape', 'portrait'] as const).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOrient(o)}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              orient === o
                ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200'
                : 'border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10'
            }`}
          >
            {o === 'landscape' ? '가로 (16:9)' : '세로 (9:16)'}
          </button>
        ))}
      </div>

      {signedUrl ? (
        <video
          key={signedUrl}
          controls
          playsInline
          poster={signedThumb ?? undefined}
          className={`w-full rounded-xl bg-black ${
            orient === 'portrait' ? 'mx-auto max-w-[360px]' : ''
          }`}
          src={signedUrl}
        />
      ) : (
        <div className="flex h-48 items-center justify-center rounded-xl bg-white/[0.03] text-sm text-white/40">
          영상을 불러오는 중...
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {signedUrl && (
          <a
            href={signedUrl}
            download
            className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-400"
          >
            MP4 다운로드
          </a>
        )}
        {c2paSigned && (
          <span className="inline-flex items-center rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            ✓ C2PA 인증 (AI 생성물 표기)
          </span>
        )}
      </div>

      <p className="mt-4 text-xs text-white/50">
        저작권이 있는 MR로 만들어진 영상은 SNS에 업로드하지 말아주세요.
      </p>
    </div>
  );
}

function FailurePanel({
  failedStep, lastError, costCredits, refunded,
}: {
  failedStep: string | null;
  lastError: string | null;
  costCredits: number;
  refunded: boolean;
}) {
  const STEP_LABEL: Record<string, string> = {
    vocal_separating: '보컬/반주 분리',
    vocal_rvc: '음색 변환',
    vocal_mixing: '보컬 믹싱',
    scene_planning: '씬 플랜 생성',
    scene_image_gen: '씬 이미지 생성',
    scene_video_gen: '씬 영상 생성',
    lipsync: '립싱크',
    composing: '영상 합성',
    formatting: '포맷 변환',
    watermarking: '워터마크',
    finalizing: '마무리',
  };

  const stepLabel = failedStep ? (STEP_LABEL[failedStep] ?? failedStep) : '알 수 없음';
  const tone = refunded
    ? { border: 'border-yellow-400/30', bg: 'bg-yellow-500/10', text: 'text-yellow-200' }
    : { border: 'border-red-400/30', bg: 'bg-red-500/10', text: 'text-red-200' };

  return (
    <div className={`mt-6 rounded-lg border ${tone.border} ${tone.bg} p-6`}>
      <div className={`text-sm font-semibold ${tone.text}`}>
        {refunded ? '크레딧이 환불되었어요' : '작업이 실패했어요'}
      </div>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-white/50">실패 단계</dt>
        <dd className="text-white/80">{stepLabel}</dd>
        {lastError && (
          <>
            <dt className="text-white/50">사유</dt>
            <dd className="text-white/70">{lastError}</dd>
          </>
        )}
        <dt className="text-white/50">크레딧</dt>
        <dd className={refunded ? 'font-semibold text-emerald-300' : 'text-white/70'}>
          {refunded ? `${costCredits}크레딧 환불 완료` : `${costCredits}크레딧 환불 대기`}
        </dd>
      </dl>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/studio/new"
          className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-400"
        >
          다시 만들기
        </Link>
        <Link
          href="/studio"
          className="rounded-md border border-white/15 px-4 py-2 text-xs text-white/70 hover:border-white/30"
        >
          스튜디오 홈
        </Link>
      </div>

      {!refunded && (
        <p className="mt-4 text-[11px] text-white/40">
          환불 처리가 30분 이상 늦어지면 고객센터로 문의해주세요.
        </p>
      )}
    </div>
  );
}

function CancelSection({ jobId, costCredits }: { jobId: string; costCredits: number }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onCancel() {
    if (!window.confirm(`정말 취소할까요? ${costCredits}크레딧이 환불돼요.`)) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/studio/jobs/${jobId}/cancel`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(body?.error ?? '취소 실패');
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch {
      setErr('네트워크 오류');
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-md border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50"
      >
        {busy ? '취소 중...' : '작업 취소 + 크레딧 환불'}
      </button>
      {err && <p className="text-xs text-red-300">{err}</p>}
      <p className="text-[11px] text-white/40">
        이미지/영상 생성이 시작된 이후에는 취소할 수 없어요.
      </p>
    </div>
  );
}

function useSignedUrl(storagePath: string | null): string | null {
  const supabase = useMemo(() => createClient(), []);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!storagePath) {
      setUrl(null);
      return;
    }
    const [bucket, ...rest] = storagePath.split('/');
    const path = rest.join('/');
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [storagePath, supabase]);

  return url;
}
