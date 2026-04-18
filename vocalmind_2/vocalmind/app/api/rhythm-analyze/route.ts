import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';
import { rhythmAnalyze } from '@/lib/infra/backend-client';
import { checkRateLimit } from '@/lib/services/rate-limiter';

/**
 * POST /api/rhythm-analyze
 *
 * 녹음 파일을 Python 백엔드 /rhythm/analyze로 프록시.
 * 실시간 WebSocket 세션 대안(재분석, 백필 등).
 *
 * multipart 필드:
 *   - audio: File (WAV/WebM)
 *   - beat_grid_json: string (BeatGridPayload JSON)
 *   - output_latency_ms: number (선택, 기본 0)
 *   - sections_json: string (선택, 기본 '[]')
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user } = auth;

  const { limited } = checkRateLimit(user.id, { limit: 15, storeMax: 5_000 });
  if (limited) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' },
      { status: 429 },
    );
  }

  try {
    const formData = await request.formData();
    const audio = formData.get('audio');
    const beatGridJson = formData.get('beat_grid_json');
    const outputLatencyMs = formData.get('output_latency_ms');
    const sectionsJson = formData.get('sections_json');

    if (!audio || !(audio instanceof File)) {
      return NextResponse.json(
        { error: '오디오 파일이 필요합니다', code: 'MISSING_AUDIO' },
        { status: 400 },
      );
    }
    if (typeof beatGridJson !== 'string') {
      return NextResponse.json(
        { error: 'beat_grid_json이 필요합니다', code: 'MISSING_BEAT_GRID' },
        { status: 400 },
      );
    }

    const latency = typeof outputLatencyMs === 'string' ? Number(outputLatencyMs) : 0;
    const sections = typeof sectionsJson === 'string' ? sectionsJson : '[]';

    const result = await rhythmAnalyze(
      audio,
      beatGridJson,
      Number.isFinite(latency) ? latency : 0,
      sections,
      audio.name || 'recording.webm',
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
