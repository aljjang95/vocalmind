import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/community/vote — 투표
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
    const body = await request.json() as { postId?: string };
    const { postId } = body;

    if (!postId) {
      return NextResponse.json(
        { error: 'postId가 필요합니다.', code: 'MISSING_FIELDS' },
        { status: 400 },
      );
    }

    // unique constraint로 중복 방지 — on conflict do nothing
    const { error } = await supabase
      .from('community_votes')
      .insert({ user_id: user.id, post_id: postId })
      .select()
      .single();

    if (error) {
      // 이미 투표했을 경우 (unique constraint violation)
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

// DELETE /api/community/vote — 투표 취소
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
    const body = await request.json() as { postId?: string };
    const { postId } = body;

    if (!postId) {
      return NextResponse.json(
        { error: 'postId가 필요합니다.', code: 'MISSING_FIELDS' },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from('community_votes')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', postId);

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
