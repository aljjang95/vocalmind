import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';

/**
 * POST /api/studio/upload
 *
 * MR 또는 raw 녹음 파일을 raw-audio 버킷에 업로드한다.
 * body: multipart { file: File, kind: 'mr' | 'recording' | 'avatar' }
 * 응답: { storagePath: 'raw-audio/{uid}/{jobPrefix}/{kind}.{ext}' }
 */
const MAX_SIZE = 40 * 1024 * 1024; // 40MB (3분 곡 + 보컬 여유)
const KINDS = ['mr', 'recording', 'avatar'] as const;
type Kind = (typeof KINDS)[number];

const BUCKET_BY_KIND: Record<Kind, string> = {
  mr: 'studio-mr',
  recording: 'studio-recording',
  avatar: 'studio-avatar',
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user, supabase } = auth;

  const form = await request.formData();
  const file = form.get('file');
  const kind = form.get('kind');

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: '파일이 필요합니다', code: 'MISSING_FILE' },
      { status: 400 },
    );
  }
  if (typeof kind !== 'string' || !KINDS.includes(kind as Kind)) {
    return NextResponse.json(
      { error: '유효하지 않은 kind', code: 'INVALID_KIND' },
      { status: 400 },
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: '파일이 40MB를 초과합니다', code: 'FILE_TOO_LARGE' },
      { status: 413 },
    );
  }

  // 파일 확장자 추출 (없으면 MIME에서 추론)
  const dotExt = file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  const mimeExt = file.type.split('/')[1]?.split(';')[0];
  const ext = dotExt ?? mimeExt ?? 'bin';

  const bucket = BUCKET_BY_KIND[kind as Kind];
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const path = `${user.id}/${timestamp}-${randomSuffix}.${ext}`;

  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: '업로드 실패', code: 'UPLOAD_ERROR', detail: uploadError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    storagePath: `${bucket}/${path}`,
    size: file.size,
  });
}
