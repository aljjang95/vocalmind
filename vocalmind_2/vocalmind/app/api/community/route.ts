import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';
import type { FeedTab, CommunityPost } from '@/types';

const DEFAULT_LIMIT = 20;

// GET /api/community — 피드 조회 (로그인 선택: 투표 여부 표시 목적)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { searchParams } = new URL(request.url);
  const tab = (searchParams.get('tab') ?? 'latest') as FeedTab;
  const cursor = searchParams.get('cursor');
  const limit = Math.min(Number(searchParams.get('limit') ?? DEFAULT_LIMIT), 50);

  try {
    let query = supabase
      .from('community_posts')
      .select(`
        id, user_id, type, title, description, audio_url,
        song_title, song_artist, vote_count, play_count,
        is_deleted, created_at
      `)
      .eq('is_deleted', false)
      .limit(limit + 1); // +1 for hasMore check

    // 탭별 필터 + 정렬
    if (tab === 'battle') {
      query = query.eq('type', 'battle');
    }

    if (tab === 'popular') {
      if (cursor) {
        query = query.lt('vote_count', Number(cursor));
      }
      query = query.order('vote_count', { ascending: false }).order('created_at', { ascending: false });
    } else {
      // latest, battle
      if (cursor) {
        query = query.lt('created_at', cursor);
      }
      query = query.order('created_at', { ascending: false });
    }

    const { data: rows, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: '게시글을 불러오지 못했습니다.', code: 'DB_ERROR' },
        { status: 500 },
      );
    }

    const hasMore = (rows?.length ?? 0) > limit;
    const posts = (rows ?? []).slice(0, limit);

    // has_voted 체크 (로그인 시)
    let votedPostIds = new Set<string>();
    if (user && posts.length > 0) {
      const postIds = posts.map((p) => p.id);
      const { data: votes } = await supabase
        .from('community_votes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', postIds);
      if (votes) {
        votedPostIds = new Set(votes.map((v) => v.post_id));
      }
    }

    // 프로필 + 아바타 별도 조회 (FK가 auth.users를 가리켜 PostgREST 조인 불가)
    const userIds = Array.from(new Set(posts.map((p) => p.user_id)));
    const profileMap = new Map<string, string>();
    const avatarMap = new Map<string, string>();
    if (userIds.length > 0) {
      const [{ data: profileRows }, { data: avatarRows }] = await Promise.all([
        supabase.from('profiles').select('id, name').in('id', userIds),
        supabase.from('avatars').select('user_id, base_image_url').in('user_id', userIds),
      ]);
      if (profileRows) {
        for (const row of profileRows) profileMap.set(row.id, row.name);
      }
      if (avatarRows) {
        for (const row of avatarRows) avatarMap.set(row.user_id, row.base_image_url);
      }
    }

    // 응답 데이터 변환
    const communityPosts: CommunityPost[] = posts.map((p) => {
      return {
        id: p.id,
        user_id: p.user_id,
        type: p.type,
        title: p.title,
        description: p.description,
        audio_url: p.audio_url,
        song_title: p.song_title,
        song_artist: p.song_artist,
        vote_count: p.vote_count,
        play_count: p.play_count,
        is_deleted: p.is_deleted,
        created_at: p.created_at,
        author_name: profileMap.get(p.user_id) ?? '익명',
        author_avatar_url: avatarMap.get(p.user_id) ?? undefined,
        has_voted: votedPostIds.has(p.id),
      };
    });

    // 다음 커서 계산
    let nextCursor: string | null = null;
    if (hasMore && communityPosts.length > 0) {
      const last = communityPosts[communityPosts.length - 1];
      nextCursor = tab === 'popular'
        ? String(last.vote_count)
        : last.created_at;
    }

    return NextResponse.json({ posts: communityPosts, cursor: nextCursor, hasMore });
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}

// POST /api/community — 게시글 작성
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user, supabase } = auth;

  try {
    const formData = await request.formData();
    const audio = formData.get('audio') as File | null;
    const title = (formData.get('title') as string | null)?.trim() ?? null;
    const description = (formData.get('description') as string | null)?.trim() ?? null;
    const song_title = (formData.get('song_title') as string | null)?.trim() ?? null;
    const song_artist = (formData.get('song_artist') as string | null)?.trim() ?? null;
    const type = (formData.get('type') as string | null) ?? 'cover';

    if (!audio) {
      return NextResponse.json(
        { error: '오디오 파일이 필요합니다.', code: 'NO_AUDIO' },
        { status: 400 },
      );
    }

    if (!['cover', 'battle', 'free'].includes(type)) {
      return NextResponse.json(
        { error: '유효하지 않은 게시글 타입입니다.', code: 'INVALID_TYPE' },
        { status: 400 },
      );
    }

    // DB insert 먼저 (ID 확보)
    const { data: post, error: insertError } = await supabase
      .from('community_posts')
      .insert({
        user_id: user.id,
        type,
        title,
        description,
        song_title,
        song_artist,
        vote_count: 0,
        play_count: 0,
        is_deleted: false,
      })
      .select('id, user_id, type, title, description, audio_url, song_title, song_artist, vote_count, play_count, is_deleted, created_at')
      .single();

    if (insertError || !post) {
      return NextResponse.json(
        { error: '게시글 작성에 실패했습니다.', code: 'DB_ERROR' },
        { status: 500 },
      );
    }

    // Supabase Storage 오디오 업로드
    const ext = audio.name.split('.').pop() ?? 'webm';
    const storagePath = `covers/${user.id}/${post.id}.${ext}`;
    const audioBuffer = await audio.arrayBuffer();

    const { error: storageError } = await supabase.storage
      .from('community-audio')
      .upload(storagePath, audioBuffer, {
        contentType: audio.type || 'audio/webm',
        upsert: true,
      });

    if (storageError) {
      // 업로드 실패 시 이미 삽입된 게시글을 삭제하고 에러 반환
      await supabase.from('community_posts').delete().eq('id', post.id);
      return NextResponse.json(
        { error: '오디오 파일 업로드에 실패했습니다.', code: 'STORAGE_ERROR' },
        { status: 500 },
      );
    }

    const { data: urlData } = supabase.storage
      .from('community-audio')
      .getPublicUrl(storagePath);
    const audioUrl = urlData.publicUrl;

    // audio_url 업데이트
    await supabase
      .from('community_posts')
      .update({ audio_url: audioUrl })
      .eq('id', post.id);

    // 프로필 정보 fetch
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    const communityPost: CommunityPost = {
      ...post,
      audio_url: audioUrl,
      author_name: profile?.name ?? '익명',
      author_avatar_url: undefined,
      has_voted: false,
    };

    return NextResponse.json({ post: communityPost }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
