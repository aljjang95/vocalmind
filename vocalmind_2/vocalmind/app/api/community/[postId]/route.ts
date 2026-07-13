import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildInternalAudioUrl, createAdminSignedStorageUrl } from '@/lib/services/storage-url';
import type { CommunityPost } from '@/types';

// GET /api/community/[postId] — 단일 게시글 상세
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  try {
    const { data: row, error } = await supabase
      .from('community_posts')
      .select(`
        id, user_id, type, title, description, audio_url,
        song_title, song_artist, vote_count, play_count,
        is_deleted, created_at
      `)
      .eq('id', postId)
      .eq('is_deleted', false)
      .single();

    if (error || !row) {
      return NextResponse.json(
        { error: '게시글을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    let hasVoted = false;
    if (user) {
      const { data: vote } = await supabase
        .from('community_votes')
        .select('id')
        .eq('user_id', user.id)
        .eq('post_id', postId)
        .maybeSingle();
      hasVoted = !!vote;
    }

    // 프로필 + 아바타 별도 조회
    const [{ data: profile }, { data: avatar }] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', row.user_id).single(),
      supabase.from('avatars').select('base_image_url').eq('user_id', row.user_id).maybeSingle(),
    ]);

    const avatarUrl = await createAdminSignedStorageUrl('avatars', avatar?.base_image_url);

    const post: CommunityPost = {
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      title: row.title,
      description: row.description,
      audio_url: row.audio_url ? buildInternalAudioUrl('community', row.id) : null,
      song_title: row.song_title,
      song_artist: row.song_artist,
      vote_count: row.vote_count,
      play_count: row.play_count,
      is_deleted: row.is_deleted,
      created_at: row.created_at,
      author_name: profile?.name ?? '익명',
      author_avatar_url: avatarUrl ?? undefined,
      has_voted: hasVoted,
    };

    return NextResponse.json({ post });
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}

// DELETE /api/community/[postId] — soft delete (본인만)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: '로그인이 필요합니다.', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  try {
    // 본인 게시글인지 확인
    const { data: row } = await supabase
      .from('community_posts')
      .select('user_id')
      .eq('id', postId)
      .eq('is_deleted', false)
      .single();

    if (!row) {
      return NextResponse.json(
        { error: '게시글을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    if (row.user_id !== user.id) {
      return NextResponse.json(
        { error: '본인 게시글만 삭제할 수 있습니다.', code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    const { error } = await supabase
      .from('community_posts')
      .update({ is_deleted: true })
      .eq('id', postId);

    if (error) {
      return NextResponse.json(
        { error: '삭제에 실패했습니다.', code: 'DB_ERROR' },
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
