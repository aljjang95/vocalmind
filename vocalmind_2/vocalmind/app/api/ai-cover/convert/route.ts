import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MONTHLY_LIMIT = 20;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  // 월별 사용량 체크
  const { data: usageCount } = await supabase.rpc('increment_cover_usage', {
    p_user_id: user.id,
  });
  if (usageCount && usageCount > MONTHLY_LIMIT) {
    return NextResponse.json(
      { error: `이번 달 변환 횟수(${MONTHLY_LIMIT}곡)를 모두 사용했습니다` },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const audioFile = formData.get('audio') as Blob | null;
  const modelId = formData.get('modelId') as string | null;
  const pitchShift = parseInt(formData.get('pitchShift') as string || '0', 10);

  if (!audioFile || !modelId) {
    return NextResponse.json({ error: '오디오 파일과 모델 ID가 필요합니다' }, { status: 400 });
  }

  if (audioFile.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: '파일 크기는 50MB 이하여야 합니다' }, { status: 400 });
  }

  // 모델 확인
  const { data: model } = await supabase
    .from('voice_models')
    .select('*')
    .eq('id', modelId)
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .single();

  if (!model) {
    return NextResponse.json({ error: '사용 가능한 모델이 아닙니다' }, { status: 400 });
  }

  // 노래 업로드
  const songId = crypto.randomUUID();
  const songPath = `${user.id}/${songId}/original.wav`;
  const audioBuffer = Buffer.from(await audioFile.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('ai-cover-songs')
    .upload(songPath, audioBuffer, { contentType: 'audio/wav' });

  if (uploadError) {
    return NextResponse.json({ error: '파일 업로드 실패' }, { status: 500 });
  }

  // 노래 레코드 생성
  await supabase.from('ai_cover_songs').insert({
    id: songId,
    user_id: user.id,
    name: (formData.get('name') as string) || '업로드된 노래',
    original_path: songPath,
    separation_status: 'processing',
  });

  // 변환 레코드 생성
  const { data: conversion, error: convError } = await supabase
    .from('ai_cover_conversions')
    .insert({
      user_id: user.id,
      song_id: songId,
      model_id: modelId,
      pitch_shift: pitchShift,
      status: 'separating',
    })
    .select()
    .single();

  if (convError) {
    return NextResponse.json({ error: convError.message }, { status: 500 });
  }

  // Modal 변환 함수 비동기 호출 (응답을 기다리지 않음)
  const modalUrl = process.env.MODAL_CONVERSION_URL;
  if (!modalUrl) {
    await supabase.from('ai_cover_conversions').update({ status: 'failed' }).eq('id', conversion.id);
    return NextResponse.json(
      { error: 'AI 커버 변환 서비스가 준비 중입니다. 잠시 후 다시 시도해주세요.', code: 'SERVICE_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  fetch(modalUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversion_id: conversion.id,
      song_path: songPath,
      model_path: model.model_path,
      index_path: model.index_path,
      pitch_shift: pitchShift,
      user_id: user.id,
      song_id: songId,
    }),
  }).catch(() => {
    // 비동기 호출 — 실패 시 Modal 쪽에서 DB 상태를 failed로 업데이트
  });

  return NextResponse.json({ conversionId: conversion.id });
}
