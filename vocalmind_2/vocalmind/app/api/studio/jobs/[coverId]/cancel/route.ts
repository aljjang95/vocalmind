import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';

/**
 * POST /api/studio/jobs/[coverId]/cancel
 *
 * 유저 요청 취소 — pending~scene_planning 단계에서만 허용.
 * 이후 단계는 외부 GPU 비용이 이미 지출된 상태라 환불 거부 (backend 검증).
 * 성공 시: status='refunded' + 크레딧 전액 환불.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ coverId: string }> },
) {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user } = auth;

  const { coverId } = await params;
  if (!coverId) {
    return NextResponse.json(
      { error: 'coverId 필수', code: 'MISSING_ID' },
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
    const res = await fetch(`${backendUrl}/orchestrator/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Orchestrator-Secret': secret,
      },
      body: JSON.stringify({ job_id: coverId, user_id: user.id }),
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
          : { error: '취소 실패', code: 'CANCEL_FAILED' },
        { status: res.status },
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (e) {
    console.error('cancel dispatch 실패:', e);
    return NextResponse.json(
      { error: '네트워크 오류 — 잠시 후 다시 시도해주세요', code: 'NETWORK_ERROR' },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
