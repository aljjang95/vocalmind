import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';
import { breathAnalyze } from '@/lib/infra/backend-client';
import { checkRateLimit } from '@/lib/services/rate-limiter';

/**
 * POST /api/breath-analyze
 *
 * 녹음 오디오를 Python /breath/analyze 로 프록시.
 * multipart 필드:
 *   - audio: File
 *   - target_exhale_sec: number (선택, 기본 10)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user } = auth;

  const { limited } = checkRateLimit(user.id, { limit: 20, storeMax: 5_000 });
  if (limited) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' },
      { status: 429 },
    );
  }

  try {
    const formData = await request.formData();
    const audio = formData.get('audio');
    const target = formData.get('target_exhale_sec');

    if (!audio || !(audio instanceof File)) {
      return NextResponse.json(
        { error: '오디오 파일이 필요합니다', code: 'MISSING_AUDIO' },
        { status: 400 },
      );
    }

    const targetSec = typeof target === 'string' ? Number(target) : 10;
    const result = await breathAnalyze(
      audio,
      Number.isFinite(targetSec) && targetSec > 0 ? targetSec : 10,
      audio.name || 'breath.webm',
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.error, code: result.error.code },
        { status: result.error.status },
      );
    }
    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
