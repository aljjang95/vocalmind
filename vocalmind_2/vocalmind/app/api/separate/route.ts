import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, checkGlobalRateLimit } from '@/lib/services/rate-limiter';

export async function POST(request: NextRequest) {
  const rawIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? '127.0.0.1';
  const ip = rawIp.replace(/[^0-9a-fA-F.:]/g, '').slice(0, 45);

  // 글로벌 rate limit (시간당 30회)
  const { limited: globalLimited } = checkGlobalRateLimit({ limit: 30 });
  if (globalLimited) {
    return NextResponse.json(
      { error: '서비스가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.', code: 'GLOBAL_RATE_LIMITED' },
      { status: 503 },
    );
  }

  // 분당 5회
  const { limited } = checkRateLimit(ip, { limit: 5 });
  if (limited) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' },
      { status: 429 },
    );
  }

  const demucsUrl = process.env.DEMUCS_API_URL;

  if (!demucsUrl) {
    return NextResponse.json(
      {
        error: '보컬 분리 서비스가 설정되지 않았습니다',
        code: 'SERVICE_NOT_CONFIGURED',
      },
      { status: 400 },
    );
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        {
          error: '오디오 파일이 필요합니다',
          code: 'MISSING_AUDIO',
        },
        { status: 400 },
      );
    }

    // VULN-1 fix: 서버 측 파일 크기 제한 (50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: '파일 크기가 50MB를 초과합니다',
          code: 'FILE_TOO_LARGE',
        },
        { status: 400 },
      );
    }

    // Proxy to external DEMUCS API
    const proxyForm = new FormData();
    proxyForm.append('audio', audioFile);

    const response = await fetch(demucsUrl, {
      method: 'POST',
      body: proxyForm,
    });

    if (!response.ok) {
      // VULN-3 fix: 외부 서비스 에러를 클라이언트에 그대로 노출하지 않음
      const errText = await response.text().catch(() => 'Unknown error');
      console.error(`[/api/separate] DEMUCS error: ${errText.slice(0, 500)}`);
      return NextResponse.json(
        {
          error: '보컬 분리 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
          code: 'SERVICE_ERROR',
        },
        { status: 502 },
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.json(
      {
        error: `보컬 분리 요청 실패: ${message}`,
        code: 'REQUEST_FAILED',
      },
      { status: 500 },
    );
  }
}
