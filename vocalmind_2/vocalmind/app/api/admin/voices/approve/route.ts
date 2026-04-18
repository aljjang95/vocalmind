import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminResult } from '@/lib/infra/admin-auth';

interface ApproveBody {
  voiceIdentityId: string;
  rvcModelPath?: string;
  rvcIndexPath?: string | null;
  mosScore?: number | null;
  markFailed?: boolean;
  reason?: string;
}

/**
 * POST /api/admin/voices/approve
 * 관리자 전용 — voice_identity를 ready(승인) 또는 failed 상태로 전이.
 * 활성 모델은 유저당 1개만(unique index)이므로 기존 ready는 archived로 내림.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!isAdminResult(auth)) return auth;
  const { service } = auth;

  let body: ApproveBody;
  try {
    body = (await request.json()) as ApproveBody;
  } catch {
    return NextResponse.json({ error: '잘못된 JSON', code: 'INVALID_JSON' }, { status: 400 });
  }

  if (!body.voiceIdentityId) {
    return NextResponse.json(
      { error: 'voiceIdentityId 필수', code: 'MISSING_ID' },
      { status: 400 },
    );
  }

  const { data: target, error: fetchErr } = await service
    .from('voice_identities')
    .select('id, user_id, status')
    .eq('id', body.voiceIdentityId)
    .maybeSingle();

  if (fetchErr || !target) {
    return NextResponse.json(
      { error: '대상 없음', code: 'NOT_FOUND', detail: fetchErr?.message },
      { status: 404 },
    );
  }

  if (body.markFailed) {
    const { error } = await service
      .from('voice_identities')
      .update({
        status: 'failed',
        last_error: (body.reason ?? '관리자 거절').slice(0, 1000),
      })
      .eq('id', target.id);

    if (error) {
      return NextResponse.json(
        { error: '실패 처리 오류', code: 'UPDATE_ERROR', detail: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, status: 'failed' });
  }

  if (!body.rvcModelPath) {
    return NextResponse.json(
      { error: 'rvcModelPath 필수', code: 'MISSING_MODEL_PATH' },
      { status: 400 },
    );
  }

  // 기존 ready는 archived로 내림 (unique index 충돌 회피)
  await service
    .from('voice_identities')
    .update({ status: 'archived' })
    .eq('user_id', target.user_id)
    .eq('status', 'ready')
    .neq('id', target.id);

  const { error: updateErr } = await service
    .from('voice_identities')
    .update({
      status: 'ready',
      rvc_model_path: body.rvcModelPath,
      rvc_index_path: body.rvcIndexPath ?? null,
      mos_score: body.mosScore ?? null,
      liveness_verified: true,
      ready_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', target.id);

  if (updateErr) {
    return NextResponse.json(
      { error: '승인 실패', code: 'UPDATE_ERROR', detail: updateErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, status: 'ready' });
}
