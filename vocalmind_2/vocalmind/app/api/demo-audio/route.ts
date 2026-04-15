import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const TEACHER_EMAIL = process.env.TEACHER_EMAIL;
const BUCKET = 'demo-audio';
const MAX_STAGE = 28;
const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/mp3'];

/**
 * POST /api/demo-audio — 시범 오디오 업로드 (선생님 전용)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== TEACHER_EMAIL) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  const formData = await request.formData();
  const audio = formData.get('audio') as Blob | null;
  const stageIdStr = formData.get('stageId') as string | null;

  if (!audio || !stageIdStr) {
    return NextResponse.json({ error: '오디오 파일과 stageId가 필요합니다' }, { status: 400 });
  }

  const stageId = parseInt(stageIdStr, 10);
  if (isNaN(stageId) || stageId < 1 || stageId > MAX_STAGE) {
    return NextResponse.json({ error: `stageId는 1~${MAX_STAGE} 범위여야 합니다` }, { status: 400 });
  }

  if (audio.size === 0) {
    return NextResponse.json({ error: '빈 파일입니다' }, { status: 400 });
  }

  if (audio.size > MAX_SIZE) {
    return NextResponse.json({ error: '파일 크기는 50MB 이하여야 합니다' }, { status: 400 });
  }

  const contentType = audio.type || 'audio/webm';
  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({ error: '지원하지 않는 형식입니다 (WAV, MP3, OGG, WebM)' }, { status: 400 });
  }

  const ext = contentType.split('/').pop() ?? 'webm';
  const filePath = `stage-${stageId}/demo.${ext}`;
  const buffer = Buffer.from(await audio.arrayBuffer());

  // 기존 파일 삭제 후 업로드
  await supabase.storage.from(BUCKET).remove([filePath]);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: `업로드 실패: ${uploadError.message}` }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  return NextResponse.json({ url: urlData.publicUrl, stageId });
}

/**
 * GET /api/demo-audio — 28단계 시범 오디오 등록 현황 (선생님 전용)
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== TEACHER_EMAIL) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  const stages = [];
  for (let id = 1; id <= MAX_STAGE; id++) {
    const { data: files } = await supabase.storage.from(BUCKET).list(`stage-${id}`);
    const hasDemo = (files ?? []).length > 0;
    let url: string | null = null;
    if (hasDemo && files && files[0]) {
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(`stage-${id}/${files[0].name}`);
      url = urlData.publicUrl;
    }
    stages.push({ stageId: id, hasDemo, url });
  }

  return NextResponse.json({ stages });
}
