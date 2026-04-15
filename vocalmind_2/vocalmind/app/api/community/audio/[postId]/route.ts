/**
 * 커뮤니티 오디오 스트리밍 프록시
 * Supabase Storage URL을 직접 노출하지 않고, 로그인 유저에게만 스트리밍 제공
 * 다운로드 방지: Content-Disposition 없음 + Cache-Control 제한
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  // 게시글에서 audio_url 조회
  const { data: post } = await supabase
    .from('community_posts')
    .select('audio_url')
    .eq('id', postId)
    .eq('is_deleted', false)
    .single();

  if (!post?.audio_url) {
    return NextResponse.json({ error: '오디오를 찾을 수 없습니다' }, { status: 404 });
  }

  // Supabase Storage에서 signed URL 생성 (60초 만료)
  const { data: signedUrl } = await supabase.storage
    .from('community-audio')
    .createSignedUrl(post.audio_url, 60);

  if (!signedUrl?.signedUrl) {
    return NextResponse.json({ error: '오디오 로드 실패' }, { status: 500 });
  }

  // signed URL로 리다이렉트 (직접 URL 노출 최소화)
  return NextResponse.redirect(signedUrl.signedUrl, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
