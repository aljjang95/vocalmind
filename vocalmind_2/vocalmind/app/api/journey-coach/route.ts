import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BACKEND_URL = process.env.VOCAL_BACKEND_URL ?? 'http://localhost:8001';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const resp = await fetch(`${BACKEND_URL}/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await resp.json() as Record<string, unknown>;

    // snake_case → camelCase 변환 (references)
    if (Array.isArray(data.references)) {
      data.references = (data.references as Array<{ video_id: string; timestamp: number }>).map(
        (ref) => ({ videoId: ref.video_id, timestamp: ref.timestamp }),
      );
    }

    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json(
      { error: '코칭 서버 연결 실패', code: 'BACKEND_ERROR' },
      { status: 502 },
    );
  }
}
