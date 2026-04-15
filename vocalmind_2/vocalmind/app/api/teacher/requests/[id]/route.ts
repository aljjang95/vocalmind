import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TEACHER_EMAIL = process.env.TEACHER_EMAIL;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== TEACHER_EMAIL) {
    return NextResponse.json({ error: '권한이 없습니다', code: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json() as { teacher_comment?: string; status?: string };

  const update: Record<string, unknown> = {};
  if (body.teacher_comment !== undefined) update.teacher_comment = body.teacher_comment;
  if (body.status !== undefined) update.status = body.status;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: '변경사항이 없습니다', code: 'NO_CHANGES' }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('feedback_requests')
    .update(update)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: '업데이트 실패', code: 'DB_ERROR' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
