'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { StudioJob } from '@/types/studio';

interface UseStudioJobReturn {
  job: StudioJob | null;
  isLoading: boolean;
  error: string | null;
}

const REFETCH_INTERVAL_MS = 15_000;

/**
 * Supabase Realtime 구독으로 studio_jobs.id 단일 행의 실시간 상태를 추적한다.
 *
 * - 초기 로드: REST GET 으로 현재 상태
 * - 이후: postgres_changes 이벤트로 UPDATE 수신
 * - 채널 에러/닫힘 시 자동 재구독 + 폴백 polling
 * - 언마운트 시 unsubscribe 필수
 */
export function useStudioJob(jobId: string | null): UseStudioJobReturn {
  const [job, setJob] = useState<StudioJob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    const supabase = createClient();
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    const fetchJob = () => {
      supabase
        .from('studio_jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle()
        .then(({ data, error: loadError }) => {
          if (cancelled) return;
          if (loadError) {
            setError(loadError.message);
          } else if (data) {
            setJob(toStudioJob(data));
          }
          setIsLoading(false);
        });
    };

    // 1) 초기 로드
    fetchJob();

    // 2) 실시간 구독 (status callback으로 재연결 처리)
    const channel = supabase
      .channel(`studio_job_${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'studio_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          if (cancelled) return;
          if (payload.new) setJob(toStudioJob(payload.new));
        },
      )
      .subscribe((status) => {
        if (cancelled) return;

        if (status === 'SUBSCRIBED') {
          // 구독 성공 — REST 초기 로드와 구독 사이 빈틈 보정
          fetchJob();
          stopPolling();
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
          // 연결 끊김 — 폴백 polling 시작
          startPolling();
        }
      });

    function startPolling() {
      if (pollRef.current) return;
      pollRef.current = setInterval(() => {
        if (!cancelled) fetchJob();
      }, REFETCH_INTERVAL_MS);
    }

    function stopPolling() {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    return () => {
      cancelled = true;
      stopPolling();
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  return { job, isLoading, error };
}

// ── snake_case → camelCase 변환 ─────────────────────────────

function toStudioJob(row: Record<string, unknown>): StudioJob {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    voiceIdentityId: (row.voice_identity_id as string | null) ?? null,
    userMrPath: row.user_mr_path as string,
    rawRecordingPath: row.raw_recording_path as string,
    stylePreset: row.style_preset as StudioJob['stylePreset'],
    avatarMode: row.avatar_mode as StudioJob['avatarMode'],
    avatarRefPath: (row.avatar_ref_path as string | null) ?? null,
    status: row.status as StudioJob['status'],
    progressPct: Number(row.progress_pct ?? 0),
    currentStepLabel: (row.current_step_label as string | null) ?? null,
    qualityTier: ((row.quality_tier as string | null) ?? 'pro') as StudioJob['qualityTier'],
    budgetUsd: Number(row.budget_usd ?? 7),
    costCredits: Number(row.cost_credits ?? 0),
    ledgerEntryId: (row.ledger_entry_id as number | null) ?? null,
    costUsdEstimated: (row.cost_usd_estimated as number | null) ?? null,
    costUsdActual: Number(row.cost_usd_actual ?? 0),
    attemptCount: Number(row.attempt_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? 3),
    lastError: (row.last_error as string | null) ?? null,
    failedStep: (row.failed_step as string | null) ?? null,
    vocalsPath: (row.vocals_path as string | null) ?? null,
    instrumentalPath: (row.instrumental_path as string | null) ?? null,
    convertedVocalsPath: (row.converted_vocals_path as string | null) ?? null,
    finalVocalMixPath: (row.final_vocal_mix_path as string | null) ?? null,
    scenePlan: (row.scene_plan as StudioJob['scenePlan']) ?? null,
    landscapeUrl: (row.landscape_url as string | null) ?? null,
    portraitUrl: (row.portrait_url as string | null) ?? null,
    thumbnailUrl: (row.thumbnail_url as string | null) ?? null,
    title: (row.title as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    c2paSigned: Boolean(row.c2pa_signed ?? false),
    createdAt: row.created_at as string,
    startedAt: (row.started_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    updatedAt: row.updated_at as string,
  };
}
