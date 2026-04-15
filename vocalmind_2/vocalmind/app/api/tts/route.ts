import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BACKEND = process.env.VOCAL_BACKEND_URL || 'http://localhost:8001';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await request.json() as { text?: string };

  if (!body.text?.trim()) {
    return NextResponse.json(
      { error: '텍스트가 필요합니다', code: 'NO_TEXT' },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${BACKEND}/onboarding/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body.text }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'TTS 생성 실패', code: 'TTS_ERROR' },
        { status: res.status }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  } catch {
    return NextResponse.json(
      { error: '백엔드 서버에 연결할 수 없습니다', code: 'BACKEND_UNREACHABLE' },
      { status: 502 }
    );
  }
}
