import 'server-only';
import { NextResponse } from 'next/server';
import { createClient as createServiceClient, type SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';

export interface AdminResult {
  user: User;
  supabase: SupabaseClient;
  service: SupabaseClient;
}

export type AdminError = NextResponse;

/**
 * 관리자 전용 가드. TEACHER_EMAIL과 일치할 때만 통과.
 * RLS 우회가 필요한 관리 작업용 service client도 함께 반환.
 */
export async function requireAdmin(): Promise<AdminResult | AdminError> {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;

  const adminEmail = process.env.TEACHER_EMAIL;
  if (!adminEmail) {
    // 무음 실패 방지 — 미설정을 권한 거부(403)와 구분해 운영자가 즉시 인지하도록 한다.
    console.error('[CONFIG] TEACHER_EMAIL 미설정 — 관리자 엔드포인트 비활성. 환경변수 설정 필요.');
    return NextResponse.json(
      { error: '관리자 기능 비활성화', code: 'ADMIN_NOT_CONFIGURED' },
      { status: 503 },
    );
  }
  if (auth.user.email !== adminEmail) {
    return NextResponse.json(
      { error: '관리자 권한 필요', code: 'FORBIDDEN' },
      { status: 403 },
    );
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  return { user: auth.user, supabase: auth.supabase, service };
}

export function isAdminResult(result: AdminResult | AdminError): result is AdminResult {
  return !(result instanceof NextResponse);
}
