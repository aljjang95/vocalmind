import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';
import { checkRateLimit } from '@/lib/services/rate-limiter';
import type { StylePreset, AvatarMode, QualityTier } from '@/types/studio';
import { STUDIO_TIERS, DEFAULT_STUDIO_TIER } from '@/types/studio';

interface CreateJobBody {
  userMrPath: string;
  rawRecordingPath: string;
  voiceIdentityId?: string | null;
  stylePreset: StylePreset;
  qualityTier?: QualityTier;  // 없으면 DEFAULT_STUDIO_TIER
  avatarMode: AvatarMode;
  avatarRefPath?: string | null;
}

const VALID_STYLES: readonly StylePreset[] = [
  'cinematic', 'cozy', 'neon_city', 'fantasy', 'retro', 'ghibli',
];
const VALID_AVATARS: readonly AvatarMode[] = ['user_photo', 'ai_realistic', 'ai_anime', 'faceless'];
const VALID_TIERS: readonly QualityTier[] = ['draft', 'pro', 'studio'];

/**
 * POST /api/studio/jobs
 *
 * 신규 MV 생성 작업을 시작한다.
 * 1) 유저 인증 + 레이트리밋
 * 2) consume_credits RPC로 5크레딧 원자적 차감
 * 3) studio_jobs(pending) insert (service role — RLS 우회로 ledger_entry_id 연결)
 * 4) FastAPI orchestrator /orchestrator/start 호출 (X-Orchestrator-Secret)
 * 5) {jobId} 즉시 반환
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user, supabase } = auth;

  const { limited } = checkRateLimit(user.id, { limit: 5, storeMax: 5_000 });
  if (limited) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' },
      { status: 429 },
    );
  }

  let body: CreateJobBody;
  try {
    body = (await request.json()) as CreateJobBody;
  } catch {
    return NextResponse.json(
      { error: '잘못된 요청 형식', code: 'INVALID_JSON' },
      { status: 400 },
    );
  }

  if (!body.userMrPath || !body.rawRecordingPath) {
    return NextResponse.json(
      { error: 'MR과 녹음 경로가 필요합니다', code: 'MISSING_PATHS' },
      { status: 400 },
    );
  }

  // 각 경로가 본인 폴더 소속인지 검증 — 교차 유저 공격 차단.
  // Storage RLS로 1차 보호되지만 service_role insert 직전 명시적 가드.
  const userPathSegment = `/${user.id}/`;
  const pathFields: Array<[keyof CreateJobBody, string | null | undefined]> = [
    ['userMrPath', body.userMrPath],
    ['rawRecordingPath', body.rawRecordingPath],
    ['avatarRefPath', body.avatarRefPath],
  ];
  for (const [field, path] of pathFields) {
    if (!path) continue;
    // "studio-mr/<user_id>/..." 형식 — 슬래시로 감싸 정확 매치
    if (!`/${path}`.includes(userPathSegment)) {
      return NextResponse.json(
        { error: `${String(field)} 경로가 본인 폴더가 아닙니다`, code: 'PATH_OWNERSHIP_VIOLATION' },
        { status: 403 },
      );
    }
  }
  if (!VALID_STYLES.includes(body.stylePreset)) {
    return NextResponse.json(
      { error: '유효하지 않은 스타일 프리셋', code: 'INVALID_STYLE' },
      { status: 400 },
    );
  }
  if (!VALID_AVATARS.includes(body.avatarMode)) {
    return NextResponse.json(
      { error: '유효하지 않은 아바타 모드', code: 'INVALID_AVATAR' },
      { status: 400 },
    );
  }

  // 품질 티어 — 없으면 기본값, 있으면 검증
  const qualityTier: QualityTier =
    body.qualityTier && VALID_TIERS.includes(body.qualityTier)
      ? body.qualityTier
      : DEFAULT_STUDIO_TIER;
  if (body.qualityTier && !VALID_TIERS.includes(body.qualityTier)) {
    return NextResponse.json(
      { error: '유효하지 않은 품질 티어', code: 'INVALID_TIER' },
      { status: 400 },
    );
  }
  const tierSpec = STUDIO_TIERS[qualityTier];

  // ready 상태의 음색 모델 필수 (RVC 변환용).
  // 명시된 voiceIdentityId가 있으면 소유 확인, 없으면 자동 선택.
  let voiceIdentityId: string | null = null;
  if (body.voiceIdentityId) {
    const { data: vi } = await supabase
      .from('voice_identities')
      .select('id, status')
      .eq('id', body.voiceIdentityId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!vi || vi.status !== 'ready') {
      return NextResponse.json(
        {
          error: '선택한 음색 모델이 학습 완료 상태가 아니에요',
          code: 'VOICE_IDENTITY_NOT_READY',
          hint: '/studio/voice-identity',
        },
        { status: 400 },
      );
    }
    voiceIdentityId = vi.id;
  } else {
    const { data: ready } = await supabase
      .from('voice_identities')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ready) {
      return NextResponse.json(
        {
          error: '먼저 내 음색을 등록해주세요',
          code: 'VOICE_IDENTITY_REQUIRED',
          hint: '/studio/voice-identity',
        },
        { status: 400 },
      );
    }
    voiceIdentityId = ready.id;
  }

  const cost = tierSpec.credits;

  // 1) 크레딧 차감 (RPC는 user 클라이언트로 호출해도 SECURITY DEFINER가 실행)
  const { data: ledgerId, error: consumeError } = await supabase.rpc('consume_credits', {
    p_user_id: user.id,
    p_amount: cost,
    p_reason: 'cover_consume',
    p_job_id: null,
  });

  if (consumeError) {
    const msg = consumeError.message || '';
    if (msg.includes('INSUFFICIENT_CREDITS')) {
      return NextResponse.json(
        { error: '크레딧이 부족합니다', code: 'INSUFFICIENT_CREDITS' },
        { status: 402 },
      );
    }
    return NextResponse.json(
      { error: '크레딧 차감 실패', code: 'CREDITS_ERROR', detail: msg },
      { status: 500 },
    );
  }

  // 2) studio_jobs(pending) insert — user 클라이언트 (RLS 정책 "jobs_insert_own" 통과)
  const { data: jobRow, error: insertError } = await supabase
    .from('studio_jobs')
    .insert({
      user_id: user.id,
      voice_identity_id: voiceIdentityId,
      user_mr_path: body.userMrPath,
      raw_recording_path: body.rawRecordingPath,
      style_preset: body.stylePreset,
      quality_tier: qualityTier,
      budget_usd: tierSpec.budgetUsd,
      avatar_mode: body.avatarMode,
      avatar_ref_path: body.avatarRefPath ?? null,
      status: 'pending',
      cost_credits: cost,
      ledger_entry_id: ledgerId,
    })
    .select('id')
    .single();

  if (insertError || !jobRow) {
    // 실패 시 크레딧 환불 (service role 필요 — grant_credits RPC는 SECURITY DEFINER라 user 클라이언트로도 OK이지만 revoke all로 막혀있어 service role 사용)
    await refundCredits(user.id, cost, null);
    return NextResponse.json(
      { error: 'job 생성 실패', code: 'INSERT_ERROR', detail: insertError?.message },
      { status: 500 },
    );
  }

  // 3) ledger_entry의 job_id 역참조 (정합성용 — 실패해도 치명적 아님)
  const service = serviceClient();
  await service
    .from('studio_credits_ledger')
    .update({ job_id: jobRow.id })
    .eq('id', ledgerId);

  // 4) FastAPI orchestrator dispatch
  try {
    await dispatchOrchestrator(jobRow.id);
  } catch (e) {
    // orchestrator 호출 실패 — job은 pending 상태로 남음 + 자동 환불
    console.error('orchestrator dispatch 실패:', e);
    await refundCredits(user.id, cost, jobRow.id);
    await service
      .from('studio_jobs')
      .update({ status: 'failed', last_error: 'orchestrator dispatch 실패' })
      .eq('id', jobRow.id);
    return NextResponse.json(
      { error: '파이프라인 시작 실패 — 크레딧이 환불되었어요', code: 'DISPATCH_ERROR' },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { jobId: jobRow.id, status: 'pending' },
    { status: 201 },
  );
}

// ── 내부 헬퍼 ──────────────────────────────────────────────────────

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function refundCredits(userId: string, amount: number, jobId: string | null): Promise<void> {
  try {
    const service = serviceClient();
    await service.rpc('grant_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_reason: 'job_refund',
      p_job_id: jobId,
      p_payment_id: null,
      p_metadata: { auto_refund: true, reason: 'job_create_failed' },
    });
  } catch (e) {
    console.error('자동 환불 실패:', e);
  }
}

async function dispatchOrchestrator(jobId: string): Promise<void> {
  const backendUrl = process.env.VOCAL_BACKEND_URL ?? 'http://localhost:8001';
  const secret = process.env.ORCHESTRATOR_SECRET;
  if (!secret) throw new Error('ORCHESTRATOR_SECRET 환경변수 누락');

  const res = await fetch(`${backendUrl}/orchestrator/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Orchestrator-Secret': secret,
    },
    body: JSON.stringify({ job_id: jobId }),
  });

  if (!res.ok) {
    throw new Error(`orchestrator ${res.status}: ${await res.text()}`);
  }
}
