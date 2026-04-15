import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/community/[postId]/play — 재생 횟수 증가
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  const supabase = await createClient();

  try {
    // read-modify-write increment
    const { data } = await supabase
      .from('community_posts')
      .select('play_count')
      .eq('id', postId)
      .single();

    if (data) {
      await supabase
        .from('community_posts')
        .update({ play_count: (data.play_count ?? 0) + 1 })
        .eq('id', postId);
    }

    return NextResponse.json({ success: true });
  } catch {
    // fire and forget — 실패해도 무시
    return NextResponse.json({ success: false });
  }
}
