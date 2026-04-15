/**
 * HQ-SVC Zero-Shot 변환 — 학습 없이 10초 레퍼런스만으로 변환
 * 무료 체험 / 학습 데이터 부족 시 사용
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DAILY_FREE_LIMIT = 3;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const formData = await request.formData();
  const sourceAudio = formData.get('sourceAudio') as Blob | null; // 변환할 곡
  const referenceAudio = formData.get('referenceAudio') as Blob | null; // 레퍼런스 (10초)
  const songName = formData.get('songName') as string || '빠른 변환';
  const presetName = formData.get('preset') as string || 'hq_svc';

  if (!sourceAudio || !referenceAudio) {
    return NextResponse.json(
      { error: '변환할 곡과 레퍼런스 오디오가 필요합니다', code: 'MISSING_FIELDS' },
      { status: 400 },
    );
  }

  if (sourceAudio.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: '파일 크기는 50MB 이하', code: 'FILE_TOO_LARGE' }, { status: 400 });
  }

  // 일일 무료 한도 체크
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from('ai_cover_conversions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('engine', 'hq_svc')
    .gte('created_at', `${today}T00:00:00Z`);

  if ((count ?? 0) >= DAILY_FREE_LIMIT) {
    // 유료 사용자는 통과, 무료는 제한
    const { data: plan } = await supabase
      .from('vocal_user_plans')
      .select('plan')
      .eq('user_id', user.id)
      .single();

    if (!plan || plan.plan === 'free') {
      return NextResponse.json(
        { error: `오늘 무료 변환 ${DAILY_FREE_LIMIT}곡을 모두 사용했습니다`, code: 'DAILY_LIMIT' },
        { status: 429 },
      );
    }
  }

  // 파일 업로드
  const conversionId = crypto.randomUUID();
  const sourcePath = `${user.id}/${conversionId}/source.wav`;
  const refPath = `${user.id}/${conversionId}/reference.wav`;

  const [sourceUpload, refUpload] = await Promise.all([
    supabase.storage.from('ai-cover-songs').upload(
      sourcePath, Buffer.from(await sourceAudio.arrayBuffer()), { contentType: 'audio/wav' },
    ),
    supabase.storage.from('ai-cover-songs').upload(
      refPath, Buffer.from(await referenceAudio.arrayBuffer()), { contentType: 'audio/wav' },
    ),
  ]);

  if (sourceUpload.error || refUpload.error) {
    return NextResponse.json({ error: '파일 업로드 실패', code: 'UPLOAD_ERROR' }, { status: 500 });
  }

  // 변환 레코드 생성
  const { data: conversion, error: convError } = await supabase
    .from('ai_cover_conversions')
    .insert({
      id: conversionId,
      user_id: user.id,
      song_id: conversionId, // quick-convert는 song_id = conversion_id
      model_id: null, // zero-shot은 모델 없음
      pitch_shift: 0,
      status: 'converting',
      engine: 'hq_svc',
    })
    .select()
    .single();

  if (convError) {
    return NextResponse.json({ error: convError.message, code: 'DB_ERROR' }, { status: 500 });
  }

  // Modal HQ-SVC 함수 비동기 호출
  const modalUrl = process.env.MODAL_HQSVC_URL;
  if (!modalUrl) {
    await supabase.from('ai_cover_conversions').update({ status: 'failed' }).eq('id', conversionId);
    return NextResponse.json(
      { error: 'AI 커버 서비스가 준비 중입니다', code: 'SERVICE_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  fetch(modalUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversion_id: conversionId,
      source_path: sourcePath,
      reference_path: refPath,
      user_id: user.id,
      preset: presetName,
    }),
  }).catch(() => {
    // 비동기 — Modal에서 DB 상태 업데이트
  });

  return NextResponse.json({ conversionId });
}
