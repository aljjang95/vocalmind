import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  const { recordingPaths, modelName, epochs = 50 } = await request.json();

  if (!recordingPaths?.length || !modelName?.trim()) {
    return NextResponse.json({ error: '녹음 파일과 모델 이름이 필요합니다' }, { status: 400 });
  }

  const { data: model, error } = await supabase
    .from('voice_models')
    .insert({
      user_id: user.id,
      name: modelName.trim(),
      status: 'training',
      epochs,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Modal 학습 함수 비동기 호출 (응답을 기다리지 않음)
  const modalUrl = process.env.MODAL_TRAINING_URL;
  if (!modalUrl) {
    await supabase.from('voice_models').update({ status: 'failed' }).eq('id', model.id);
    return NextResponse.json(
      { error: 'AI 커버 학습 서비스가 준비 중입니다. 잠시 후 다시 시도해주세요.', code: 'SERVICE_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  fetch(modalUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model_id: model.id,
      recording_paths: recordingPaths,
      user_id: user.id,
      model_name: modelName.trim(),
      epochs,
    }),
  }).catch(() => {
    // 비동기 호출 — 실패해도 이미 DB에 training 상태로 기록됨
  });

  return NextResponse.json({ modelId: model.id });
}
