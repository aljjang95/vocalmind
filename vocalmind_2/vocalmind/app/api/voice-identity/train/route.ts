import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';

interface ClipInput {
  storagePath: string;
  durationSec: number;
}

interface TrainBody {
  clips: ClipInput[];
}

const MIN_CLIPS = 8;   // 10문장 중 2개 실패 허용
const MIN_TOTAL_SEC = 30;

/**
 * POST /api/voice-identity/train
 *
 * 10문장 녹음이 끝난 후 호출. voice_identities 행을 생성하고 학습 큐에 넣는다.
 * Phase 0은 Modal RVC 학습 함수 미배포 → status='training'으로 두고 운영자가 수동 학습 후
 * 'ready'로 플립. Modal 학습 함수 배포(W4) 이후 dispatch_rvc_train 자동 호출.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user, supabase } = auth;

  let body: TrainBody;
  try {
    body = (await request.json()) as TrainBody;
  } catch {
    return NextResponse.json({ error: '잘못된 JSON', code: 'INVALID_JSON' }, { status: 400 });
  }

  const clips = Array.isArray(body.clips) ? body.clips : [];
  if (clips.length < MIN_CLIPS) {
    return NextResponse.json(
      { error: `녹음이 ${MIN_CLIPS}개 이상 필요해요`, code: 'NOT_ENOUGH_CLIPS' },
      { status: 400 },
    );
  }
  if (clips.length > 15) {
    return NextResponse.json(
      { error: '녹음이 너무 많습니다 (최대 15개)', code: 'TOO_MANY_CLIPS' },
      { status: 400 },
    );
  }

  // 각 clip 검증: duration 1~60초, storagePath 본인 폴더
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const dur = Number(c.durationSec);
    if (!Number.isFinite(dur) || dur < 1 || dur > 60) {
      return NextResponse.json(
        {
          error: `${i + 1}번 녹음 길이가 비정상 (1~60초만 허용)`,
          code: 'INVALID_DURATION',
        },
        { status: 400 },
      );
    }
    if (typeof c.storagePath !== 'string' || !c.storagePath.includes(`/${user.id}/`)) {
      return NextResponse.json(
        { error: `${i + 1}번 업로드 경로가 올바르지 않아요`, code: 'INVALID_PATH' },
        { status: 403 },
      );
    }
  }

  // storagePath 중복 방지 (같은 파일 여러 번 제출 공격)
  const pathSet = new Set(clips.map((c) => c.storagePath));
  if (pathSet.size !== clips.length) {
    return NextResponse.json(
      { error: '중복된 녹음 경로가 있습니다', code: 'DUPLICATE_PATH' },
      { status: 400 },
    );
  }

  const totalSec = clips.reduce((acc, c) => acc + (Number(c.durationSec) || 0), 0);
  if (totalSec < MIN_TOTAL_SEC) {
    return NextResponse.json(
      { error: '녹음 총 길이가 너무 짧아요 (30초 이상 필요)', code: 'TOO_SHORT' },
      { status: 400 },
    );
  }

  // 기존 active row를 archived로 내림 (재등록 허용)
  await supabase
    .from('voice_identities')
    .update({ status: 'archived' })
    .eq('user_id', user.id)
    .in('status', ['collecting', 'ready', 'failed']);

  const sourceClips = clips.map((c, i) => ({
    sentence_index: i,
    storage_path: c.storagePath,
    duration_sec: Number(c.durationSec) || 0,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from('voice_identities')
    .insert({
      user_id: user.id,
      status: 'training',
      source_clip_count: clips.length,
      total_duration_sec: totalSec,
      liveness_verified: false,
      source_clips: sourceClips,
    })
    .select('id, status')
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: '등록 실패', code: 'INSERT_ERROR', detail: insertErr?.message },
      { status: 500 },
    );
  }

  // 학습 큐에 clip 경로 기록 (service role 테이블 아직 없음 — Phase 0은 관리 대시보드에서 수동)
  // TODO(W4): modal_dispatcher.dispatch_rvc_train 자동 호출

  return NextResponse.json({
    voiceIdentityId: inserted.id,
    status: inserted.status,
    message: '음색 학습을 시작했어요. 완료되면 알려드릴게요.',
  });
}
