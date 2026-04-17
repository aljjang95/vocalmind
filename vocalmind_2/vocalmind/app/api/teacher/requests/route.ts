import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';

const TEACHER_EMAIL = process.env.TEACHER_EMAIL;

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user, supabase } = auth;

  if (user.email !== TEACHER_EMAIL) {
    return NextResponse.json({ error: '권한이 없습니다', code: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status'); // 'pending' | 'completed' | null(전체)

  let query = supabase
    .from('feedback_requests')
    .select('id, user_id, audio_path, concern, status, teacher_comment, created_at, profiles(email, full_name)')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json({ requests: [], total: 0 });
    }
    return NextResponse.json({ error: '조회 실패', code: 'DB_ERROR' }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [], total: (data ?? []).length });
}
