import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminResult } from '@/lib/infra/admin-auth';

// service role 클라이언트로 임의 버킷 signed URL을 발급하지 못하도록 검수용 버킷만 허용.
const ALLOWED_BUCKETS = new Set([
  'studio-recording',
  'studio-mr',
  'studio-avatar',
  'vocal-clips',
  'mv-output',
]);

/**
 * GET /api/admin/voices/clip-url?path=bucket/key
 * 관리자 전용 — Storage 오브젝트의 signed URL 발급 (듣기/다운로드용).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!isAdminResult(auth)) return auth;
  const { service } = auth;

  const full = request.nextUrl.searchParams.get('path');
  if (!full || !full.includes('/')) {
    return NextResponse.json({ error: 'invalid path', code: 'INVALID_PATH' }, { status: 400 });
  }

  const [bucket, ...rest] = full.split('/');
  const key = rest.join('/');
  if (!bucket || !key) {
    return NextResponse.json({ error: 'invalid path', code: 'INVALID_PATH' }, { status: 400 });
  }
  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: 'bucket not allowed', code: 'BUCKET_FORBIDDEN' }, { status: 400 });
  }

  const { data, error } = await service.storage.from(bucket).createSignedUrl(key, 3600);
  if (error || !data) {
    return NextResponse.json(
      { error: 'signed URL 발급 실패', code: 'SIGN_ERROR', detail: error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
