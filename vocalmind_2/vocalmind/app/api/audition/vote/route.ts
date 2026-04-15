import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/audition/vote — 투표
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: '로그인이 필요합니다.', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json() as { entryId?: string };
    const { entryId } = body;

    if (!entryId) {
      return NextResponse.json(
        { error: 'entryId가 필요합니다.', code: 'MISSING_FIELDS' },
        { status: 400 },
      );
    }

    // 자기 자신 투표 방지
    const { data: entryRow, error: entryError } = await supabase
      .from('audition_entries')
      .select('user_id')
      .eq('id', entryId)
      .maybeSingle();

    if (entryError || !entryRow) {
      return NextResponse.json(
        { error: '참가 항목을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    if (entryRow.user_id === user.id) {
      return NextResponse.json(
        { error: '자신의 항목에는 투표할 수 없습니다.', code: 'SELF_VOTE' },
        { status: 400 },
      );
    }

    // unique constraint로 중복 방지
    const { error } = await supabase
      .from('audition_votes')
      .insert({ user_id: user.id, entry_id: entryId });

    if (error) {
      // 이미 투표한 경우 (unique constraint violation)
      if (error.code === '23505') {
        return NextResponse.json({ success: true, already: true });
      }
      return NextResponse.json(
        { error: '투표에 실패했습니다.', code: 'DB_ERROR' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}

// DELETE /api/audition/vote — 투표 취소
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: '로그인이 필요합니다.', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json() as { entryId?: string };
    const { entryId } = body;

    if (!entryId) {
      return NextResponse.json(
        { error: 'entryId가 필요합니다.', code: 'MISSING_FIELDS' },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from('audition_votes')
      .delete()
      .eq('user_id', user.id)
      .eq('entry_id', entryId);

    if (error) {
      return NextResponse.json(
        { error: '투표 취소에 실패했습니다.', code: 'DB_ERROR' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
