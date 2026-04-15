import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TEACHER_EMAIL = process.env.TEACHER_EMAIL;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== TEACHER_EMAIL) {
    return NextResponse.json({ error: '권한이 없습니다', code: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get('path');
  if (!path) {
    return NextResponse.json({ error: 'path 파라미터가 필요합니다', code: 'NO_PATH' }, { status: 400 });
  }

  // 경로 순회 방어: feedback/ 하위 경로만 허용
  // '..' 포함 또는 허용된 접두사가 아닌 경우 차단
  const normalizedPath = path.replace(/\\/g, '/');
  if (normalizedPath.includes('..') || !normalizedPath.startsWith('feedback/')) {
    return NextResponse.json({ error: '허용되지 않는 경로입니다', code: 'FORBIDDEN' }, { status: 403 });
  }

  const { data, error } = await supabase.storage
    .from('ai-cover-songs')
    .createSignedUrl(path, 3600); // 1시간 유효

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'URL 생성 실패', code: 'STORAGE_ERROR' }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
