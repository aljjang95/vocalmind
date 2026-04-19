'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { StudioJob } from '@/types/studio';

type VoiceStatus = 'ready' | 'training' | 'collecting' | 'failed' | 'none';
type JobFilter = 'all' | 'active' | 'completed' | 'failed';

const PAGE_SIZE = 10;
const ACTIVE_POLL_MS = 5_000;

const ACTIVE_STATUSES = [
  'pending', 'vocal_separating', 'vocal_rvc', 'vocal_mixing',
  'scene_planning', 'scene_image_gen', 'scene_video_gen',
  'lipsync', 'composing', 'formatting', 'watermarking', 'finalizing',
];

const FILTER_STATUSES: Record<JobFilter, string[] | null> = {
  all: null,
  active: ACTIVE_STATUSES,
  completed: ['completed'],
  failed: ['failed', 'refunded'],
};

export default function StudioHomeClient() {
  const [balance, setBalance] = useState<number | null>(null);
  const [jobs, setJobs] = useState<StudioJob[]>([]);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<JobFilter>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshBalance = useCallback(async () => {
    const r = await fetch('/api/credits/balance');
    if (r.ok) {
      const { balance: b } = (await r.json()) as { balance: number };
      setBalance(b);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const [balanceRes, jobsRes, voice, activeTotal] = await Promise.all([
          fetch('/api/credits/balance'),
          loadJobs(filter, page),
          loadVoiceStatus(),
          loadActiveCount(),
        ]);
        if (cancelled) return;

        if (balanceRes.ok) {
          const { balance: b } = (await balanceRes.json()) as { balance: number };
          setBalance(b);
        }
        setJobs((prev) => (page === 0 ? jobsRes : [...prev, ...jobsRes]));
        setHasMore(jobsRes.length === PAGE_SIZE);
        setVoiceStatus(voice);
        setActiveCount(activeTotal);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [filter, page]);

  // 활성 작업이 있으면 5s마다 첫 페이지 + 잔액 + 카운트 자동 갱신.
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (activeCount === 0) return;

    pollRef.current = setInterval(async () => {
      const [firstPage, nextActiveCount] = await Promise.all([
        loadJobs(filter, 0),
        loadActiveCount(),
      ]);
      // 현재 페이지 0일 때만 리스트 갱신 (스크롤 위치 교란 방지).
      if (page === 0) {
        setJobs((prev) => {
          if (prev.length <= firstPage.length) return firstPage;
          // 추가 페이지 누적 상태 보존: 앞쪽만 교체.
          return [...firstPage, ...prev.slice(firstPage.length)];
        });
      }
      setActiveCount(nextActiveCount);
      // 작업이 터미널로 이동하면 환불/차감 반영 위해 잔액도 재조회.
      if (nextActiveCount !== activeCount) {
        await refreshBalance();
      }
    }, ACTIVE_POLL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeCount, filter, page, refreshBalance]);

  const switchFilter = (next: JobFilter) => {
    setFilter(next);
    setPage(0);
    setJobs([]);
  };

  return (
    <main className="mx-auto max-w-[960px] px-5 py-10">
      {/* 헤더 */}
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-white">AI 스튜디오</h1>
          <p className="mt-1 text-sm text-white/60">내 목소리로 뮤직비디오를 만들어요</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs">
            <span className="text-white/50">크레딧</span>{' '}
            <span className="font-semibold text-white">
              {balance === null ? '...' : balance}
            </span>
          </div>
          <Link
            href="/credits"
            className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30"
          >
            충전
          </Link>
        </div>
      </header>

      {/* 음색 등록 상태 */}
      <VoiceStatusCard status={voiceStatus} />

      {/* CTA */}
      <section className="mb-10 rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-8">
        <h2 className="text-xl font-bold text-white">첫 커버를 만들어보세요</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          MR을 올리고, 노래를 녹음하고, 스타일을 고르면 약 15분 후 뮤직비디오가 완성됩니다.
          <br />
          Phase 0 베타: 본인이 준비한 MR만 사용 가능합니다.
        </p>
        <Link
          href={voiceStatus === 'ready' ? '/studio/new' : '/studio/voice-identity'}
          className="mt-5 inline-block rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
        >
          {voiceStatus === 'ready' ? '커버 만들기 (5크레딧)' : '먼저 내 음색 등록하기'}
        </Link>
      </section>

      {/* 최근 작업 */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50">
            내 작업
          </h3>
          <div className="flex gap-1 rounded-lg bg-white/5 p-1">
            {(['all', 'active', 'completed', 'failed'] as JobFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => switchFilter(f)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  filter === f
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                <span>{FILTER_LABELS[f]}</span>
                {f === 'active' && activeCount > 0 && (
                  <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-500/30 px-1.5 text-[10px] font-bold text-emerald-200">
                    {activeCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {isLoading && jobs.length === 0 ? (
          <div className="text-sm text-white/40">불러오는 중...</div>
        ) : jobs.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/40">
            {filter === 'all'
              ? '아직 작업이 없어요. 첫 커버를 만들어보세요.'
              : '이 상태의 작업이 없어요.'}
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </ul>
            {hasMore && (
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={isLoading}
                className="mt-4 w-full rounded-lg border border-white/10 py-2.5 text-xs text-white/60 hover:border-white/20 hover:text-white/80 disabled:opacity-50"
              >
                {isLoading ? '불러오는 중...' : '더 보기'}
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function JobRow({ job }: { job: StudioJob }) {
  const statusColor = statusColorMap[job.status] ?? 'text-white/60';
  const barColor = job.status === 'failed'
    ? 'bg-red-400'
    : job.status === 'refunded'
      ? 'bg-yellow-400'
      : 'bg-emerald-400';

  return (
    <li>
      <Link
        href={`/studio/${job.id}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded-lg"
      >
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06]">
          <div>
            <div className="text-sm font-semibold text-white">{job.title ?? '이름 없음'}</div>
            <div className="mt-0.5 text-xs text-white/40">
              {new Date(job.createdAt).toLocaleString('ko-KR')}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold ${statusColor}`}>
              {job.currentStepLabel ?? job.status}
            </span>
            <div className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full ${barColor}`}
                style={{ width: `${job.progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

const statusColorMap: Record<string, string> = {
  completed: 'text-emerald-300',
  failed: 'text-red-300',
  refunded: 'text-yellow-300',
};

function VoiceStatusCard({ status }: { status: VoiceStatus }) {
  if (status === 'ready') {
    return (
      <section className="mb-6 flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-500/[0.04] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-sm text-white/80">내 음색 모델 준비 완료</span>
        </div>
        <Link href="/studio/voice-identity" className="text-xs text-emerald-300 hover:underline">
          재등록
        </Link>
      </section>
    );
  }
  if (status === 'training') {
    return (
      <section className="mb-6 flex items-center justify-between rounded-xl border border-yellow-400/20 bg-yellow-500/[0.04] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
          <span className="text-sm text-white/80">음색 학습 중 — 완료되면 이메일로 알려드려요</span>
        </div>
      </section>
    );
  }
  return (
    <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-white/30" />
        <span className="text-sm text-white/70">커버를 만들려면 먼저 내 음색을 등록해주세요</span>
      </div>
      <Link
        href="/studio/voice-identity"
        className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
      >
        음색 등록 시작 →
      </Link>
    </section>
  );
}

async function loadVoiceStatus(): Promise<VoiceStatus> {
  const supabase = createClient();
  const { data } = await supabase
    .from('voice_identities')
    .select('status')
    .in('status', ['ready', 'training', 'collecting', 'failed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.status as VoiceStatus) ?? 'none';
}

async function loadActiveCount(): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from('studio_jobs')
    .select('id', { count: 'exact', head: true })
    .in('status', ACTIVE_STATUSES);
  return count ?? 0;
}

const FILTER_LABELS: Record<JobFilter, string> = {
  all: '전체',
  active: '진행중',
  completed: '완료',
  failed: '실패',
};

async function loadJobs(filter: JobFilter, page: number): Promise<StudioJob[]> {
  const supabase = createClient();
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('studio_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to);

  const statuses = FILTER_STATUSES[filter];
  if (statuses) {
    query = query.in('status', statuses);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    userId: row.user_id,
    voiceIdentityId: row.voice_identity_id ?? null,
    userMrPath: row.user_mr_path,
    rawRecordingPath: row.raw_recording_path,
    stylePreset: row.style_preset,
    avatarMode: row.avatar_mode,
    avatarRefPath: row.avatar_ref_path ?? null,
    status: row.status,
    progressPct: Number(row.progress_pct ?? 0),
    currentStepLabel: row.current_step_label ?? null,
    qualityTier: (row.quality_tier ?? 'pro') as 'draft' | 'pro' | 'studio',
    budgetUsd: Number(row.budget_usd ?? 7),
    costCredits: Number(row.cost_credits ?? 0),
    ledgerEntryId: row.ledger_entry_id ?? null,
    costUsdEstimated: row.cost_usd_estimated ?? null,
    costUsdActual: Number(row.cost_usd_actual ?? 0),
    attemptCount: Number(row.attempt_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? 3),
    lastError: row.last_error ?? null,
    failedStep: row.failed_step ?? null,
    vocalsPath: row.vocals_path ?? null,
    instrumentalPath: row.instrumental_path ?? null,
    convertedVocalsPath: row.converted_vocals_path ?? null,
    finalVocalMixPath: row.final_vocal_mix_path ?? null,
    scenePlan: row.scene_plan ?? null,
    landscapeUrl: row.landscape_url ?? null,
    portraitUrl: row.portrait_url ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    title: row.title ?? null,
    description: row.description ?? null,
    c2paSigned: Boolean(row.c2pa_signed ?? false),
    createdAt: row.created_at,
    startedAt: row.started_at ?? null,
    completedAt: row.completed_at ?? null,
    updatedAt: row.updated_at,
  }));
}
