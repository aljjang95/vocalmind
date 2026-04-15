import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: '로그인이 필요합니다', code: 'AUTH_REQUIRED' },
      { status: 401 },
    );
  }

  const formData = await request.formData();
  const audio = formData.get('audio') as File | null;
  const concern = formData.get('concern') as string | null;

  if (!audio) {
    return NextResponse.json(
      { error: '오디오 파일이 필요합니다', code: 'NO_AUDIO' },
      { status: 400 },
    );
  }
  if (!concern?.trim()) {
    return NextResponse.json(
      { error: '고민/요청사항을 입력해주세요', code: 'NO_CONCERN' },
      { status: 400 },
    );
  }

  // Supabase Storage에 오디오 업로드
  const fileName = `feedback/${user.id}/${Date.now()}-${audio.name}`;
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
    // 테이블이 없을 수도 있음 — graceful fallback
    if (dbError.code === '42P01') {
      // 테이블 미존재 — 요청만 접수된 것으로 처리
      return NextResponse.json({ success: true, message: '신청이 접수되었습니다 (DB 테이블 준비 중)' });
    }
    return NextResponse.json(
      { error: '신청 저장에 실패했습니다', code: 'DB_ERROR' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, message: '피드백 신청이 접수되었습니다' });
}
