import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminResult } from '@/lib/infra/admin-auth';

interface ForceFailBody {
  jobId: string;
  reason: string;
}

/**
 * POST /api/admin/studio/force-fail
 *
 * TEACHER_EMAIL 관리자만 호출 가능. 멈춘 job을 강제 failed + 크레딧 환불.
 * Modal/Runware 콜백 유실 등 외부 장애 복구용.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminResult(admin)) return admin;

  let body: ForceFailBody;
  try {
    body = (await request.json()) as ForceFailBody;
  } catch {
    return NextResponse.json(
      { error: '잘못된 JSON', code: 'INVALID_JSON' },
      { status: 400 },
    );
  }

  if (!body.jobId || !body.reason?.trim()) {
    return NextResponse.json(
      { error: 'jobId와 reason이 필요합니다', code: 'MISSING_FIELDS' },
      { status: 400 },
    );
  }

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
    const res = await fetch(`${backendUrl}/orchestrator/admin/force-fail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Orchestrator-Secret': secret,
      },
      body: JSON.stringify({
        job_id: body.jobId,
        reason: `${admin.user.email}: ${body.reason.trim()}`,
      }),
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = (payload && typeof payload === 'object' && 'detail' in payload)
        ? (payload as { detail: unknown }).detail
        : payload;
      return NextResponse.json(
        typeof detail === 'object' && detail !== null
          ? detail
          : { error: '강제 실패 처리 실패', code: 'FORCE_FAIL_ERROR' },
        { status: res.status },
      );
    }
    return NextResponse.json(payload, { status: 200 });
  } catch (e) {
    console.error('force-fail dispatch 실패:', e);
    return NextResponse.json(
      { error: '네트워크 오류', code: 'NETWORK_ERROR' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
