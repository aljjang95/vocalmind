import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminSignedStorageUrl } from '@/lib/services/storage-url';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const { entryId } = await params;
  const supabase = await createClient();

  const { data: entry } = await supabase
    .from('audition_entries')
    .select('audio_url')
    .eq('id', entryId)
    .maybeSingle();

  if (!entry?.audio_url) {
    return NextResponse.json({ error: '오디오를 찾을 수 없습니다' }, { status: 404 });
  }

  const signedUrl = await createAdminSignedStorageUrl('audition-audio', entry.audio_url, 60);
  if (!signedUrl) {
    return NextResponse.json({ error: '오디오 로드 실패' }, { status: 500 });
  }

  return NextResponse.redirect(signedUrl, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
