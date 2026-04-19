import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminResult } from '@/lib/infra/admin-auth';

/**
 * GET /api/admin/studio/stuck-jobs?minutes=30
 *
 * TEACHER_EMAIL 관리자만 호출 가능. FastAPI orchestrator에 위임.
 * updated_at이 `minutes`분 이상 갱신되지 않은 active 상태 job 조회.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminResult(admin)) return admin;

  const minutes = Number(request.nextUrl.searchParams.get('minutes') ?? 30);
  const clamped = Math.min(Math.max(Number.isFinite(minutes) ? minutes : 30, 1), 1440);

  const backendUrl = process.env.VOCAL_BACKEND_URL ?? 'http://localhost:8001';
  const secret = process.env.ORCHESTRATOR_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: '서버 설정 오류', code: 'CONFIG_ERROR' },
      { status: 500 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(
      `${backendUrl}/orchestrator/admin/stuck-jobs?older_than_minutes=${clamped}`,
      {
        headers: { 'X-Orchestrator-Secret': secret },
        signal: controller.signal,
      },
    );
    const payload = await res.json().catch(() => ({}));
    return NextResponse.json(payload, { status: res.status });
  } catch (e) {
    console.error('stuck-jobs dispatch 실패:', e);
    return NextResponse.json(
      { error: '네트워크 오류', code: 'NETWORK_ERROR' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
