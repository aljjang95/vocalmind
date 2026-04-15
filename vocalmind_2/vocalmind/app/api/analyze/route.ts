import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BACKEND_URL = process.env.VOCAL_BACKEND_URL ?? 'http://localhost:8001';

/**
 * POST /api/analyze
 * 음성 파일을 Python 백엔드 /evaluate로 프록시하여 분석 결과를 반환한다.
 * 클라이언트에서 multipart/form-data로 audio + stage_id를 전송.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const audio = formData.get('audio');
    const stageId = formData.get('stage_id') ?? '1';

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json(
        { error: '음성 파일이 필요합니다.', code: 'MISSING_AUDIO' },
        { status: 400 },
      );
    }

    const backendForm = new FormData();
    backendForm.append('audio', audio, 'recording.webm');
    backendForm.append('stage_id', String(stageId));
    backendForm.append('target_pitches', '[]');

    const res = await fetch(`${BACKEND_URL}/evaluate`, {
      method: 'POST',
      body: backendForm,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errBody.detail ?? '음성 분석에 실패했습니다.', code: 'ANALYSIS_FAILED' },
        { status: res.status },
      );
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[/api/analyze]', msg);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
