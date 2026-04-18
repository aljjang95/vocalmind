import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminResult } from '@/lib/infra/admin-auth';

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

  const { data, error } = await service.storage.from(bucket).createSignedUrl(key, 3600);
  if (error || !data) {
    return NextResponse.json(
      { error: 'signed URL 발급 실패', code: 'SIGN_ERROR', detail: error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
