import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BACKEND = process.env.VOCAL_BACKEND_URL || 'http://localhost:8001';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const formData = await request.formData();
  const audio = formData.get('audio');

  if (!audio) {
    return NextResponse.json(
      { error: '오디오 파일이 필요합니다', code: 'NO_AUDIO' },
      { status: 400 }
    );
  }

  const backendForm = new FormData();
  backendForm.append('audio', audio);

  try {
    const res = await fetch(`${BACKEND}/onboarding/analyze`, {
      method: 'POST',
      body: backendForm,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: '분석 실패' })) as { detail?: string };
      return NextResponse.json(
        { error: err.detail || '분석 실패', code: 'ANALYZE_ERROR' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: '백엔드 서버에 연결할 수 없습니다', code: 'BACKEND_UNREACHABLE' },
      { status: 502 }
    );
  }
}
