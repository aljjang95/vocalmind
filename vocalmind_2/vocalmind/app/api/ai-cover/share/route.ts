/**
 * AI 커버 결과를 커뮤니티에 자동 게시
 * 변환 완료된 커버를 커뮤니티 피드에 공유
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { conversionId, title, description } = await request.json();

  if (!conversionId) {
    return NextResponse.json({ error: '변환 ID가 필요합니다', code: 'MISSING_FIELDS' }, { status: 400 });
  }

  // 변환 결과 확인 (본인 것 + 완료 상태)
  const { data: conversion } = await supabase
    .from('ai_cover_conversions')
    .select('*, ai_cover_songs(name, artist)')
    .eq('id', conversionId)
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .single();

  if (!conversion) {
    return NextResponse.json(
      { error: '공유할 수 있는 변환 결과가 없습니다', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  if (!conversion.output_path) {
    return NextResponse.json(
      { error: '변환 결과 파일이 없습니다', code: 'NO_OUTPUT' },
      { status: 400 },
    );
  }

  // 이미 공유했는지 확인
  const { data: existing } = await supabase
    .from('community_posts')
    .select('id')
    .eq('user_id', user.id)
    .eq('audio_url', conversion.output_path)
    .eq('is_deleted', false)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: '이미 공유된 커버입니다', code: 'ALREADY_SHARED' },
      { status: 409 },
    );
  }

  // 커뮤니티 게시글 생성
  const songName = conversion.ai_cover_songs?.name || '커버곡';
  const songArtist = conversion.ai_cover_songs?.artist || null;
  const { data: post, error } = await supabase
    .from('community_posts')
    .insert({
      user_id: user.id,
      type: 'cover',
      title: title || `AI 커버: ${songName}`,
      description: description || null,
      audio_url: conversion.output_path,
      song_title: songName,
      song_artist: songArtist,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: '게시 실패', code: 'DB_ERROR' }, { status: 500 });
  }

  return NextResponse.json({ postId: post.id });
}
