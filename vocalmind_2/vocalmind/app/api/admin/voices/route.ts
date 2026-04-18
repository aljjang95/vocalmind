import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminResult } from '@/lib/infra/admin-auth';

/**
 * GET /api/admin/voices?status=training|ready|failed
 * 관리자 전용 — voice_identities 목록.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!isAdminResult(auth)) return auth;
  const { service } = auth;

  const status = request.nextUrl.searchParams.get('status') ?? 'training';
  if (!['training', 'ready', 'failed', 'collecting'].includes(status)) {
    return NextResponse.json({ error: 'invalid status', code: 'INVALID_STATUS' }, { status: 400 });
  }

  const { data, error } = await service
    .from('voice_identities')
    .select(
      'id, user_id, status, source_clip_count, total_duration_sec, source_clips, rvc_model_path, rvc_index_path, last_error, created_at, ready_at, mos_score',
    )
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json(
      { error: '조회 실패', code: 'QUERY_ERROR', detail: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ items: data ?? [] });
}
