import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';
import { validateAudioFile, getSafeAudioExtension } from '@/lib/services/upload-validation';

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user, supabase } = auth;

  const formData = await request.formData();
  const audio = formData.get('audio') as File | null;
  const concern = formData.get('concern') as string | null;

  if (!audio) {
    return NextResponse.json(
      { error: '오디오 파일이 필요합니다', code: 'NO_AUDIO' },
      { status: 400 },
    );
  }
  const validation = validateAudioFile(audio, { maxBytes: MAX_AUDIO_BYTES });
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error, code: validation.code },
      { status: validation.code === 'FILE_TOO_LARGE' ? 413 : 400 },
    );
  }
  if (!concern?.trim()) {
    return NextResponse.json(
      { error: '고민/요청사항을 입력해주세요', code: 'NO_CONCERN' },
      { status: 400 },
    );
  }

  // Supabase Storage에 오디오 업로드
  const ext = getSafeAudioExtension(audio);
  const fileName = `feedback/${user.id}/${Date.now()}.${ext}`;
  const arrayBuffer = await audio.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from('ai-cover-songs') // 기존 버킷 재사용
    .upload(fileName, arrayBuffer, { contentType: audio.type });

  if (uploadError) {
    // Storage 없으면 DB에만 저장 (파일 경로 없이)
    console.warn('Storage upload failed, saving without file:', uploadError.message);
  }

  // DB에 피드백 요청 저장
  const { error: dbError } = await supabase
    .from('feedback_requests')
    .insert({
      user_id: user.id,
      audio_path: uploadError ? null : fileName,
      concern: concern.trim(),
      status: 'pending',
    });

  if (dbError) {
    return NextResponse.json(
      { error: '신청 저장에 실패했습니다', code: 'DB_ERROR' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, message: '피드백 신청이 접수되었습니다' });
}
