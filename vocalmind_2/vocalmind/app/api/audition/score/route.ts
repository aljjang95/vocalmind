import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';
import { auditionScore } from '@/lib/infra/backend-client';
import { checkRateLimit } from '@/lib/services/rate-limiter';

interface ScoreRequestBody {
  tensionOverall: number;
  pitchAccuracy: number;
  rhythmScore?: number | null;
  voteScore?: number;
  alpha?: number;
}

/**
 * POST /api/audition/score
 *
 * 오디션 참가 제출의 개별 지표를 받아 AI 종합 + 최종 랭킹 점수 계산.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user } = auth;

  const { limited } = checkRateLimit(user.id, { limit: 30, storeMax: 5_000 });
  if (limited) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다', code: 'RATE_LIMITED' },
      { status: 429 },
    );
  }

  let body: ScoreRequestBody;
  try {
    body = (await request.json()) as ScoreRequestBody;
  } catch {
    return NextResponse.json(
      { error: '잘못된 요청 형식입니다', code: 'INVALID_JSON' },
      { status: 400 },
    );
  }

  if (
    typeof body.tensionOverall !== 'number' ||
    typeof body.pitchAccuracy !== 'number'
  ) {
    return NextResponse.json(
      { error: 'tensionOverall과 pitchAccuracy는 숫자여야 합니다', code: 'INVALID_FIELDS' },
      { status: 400 },
    );
  }

  const result = await auditionScore({
    tensionOverall: body.tensionOverall,
    pitchAccuracy: body.pitchAccuracy,
    rhythmScore: body.rhythmScore ?? null,
    voteScore: body.voteScore ?? 0,
    alpha: body.alpha ?? 0.3,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error.error, code: result.error.code },
      { status: result.error.status },
    );
  }
  return NextResponse.json(result.data);
}
