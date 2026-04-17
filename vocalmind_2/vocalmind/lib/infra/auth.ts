import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

// ── 인증 결과 타입 ───────────────────────────────────────────
export interface AuthResult {
  user: User;
  supabase: SupabaseClient;
}

// 인증 실패 응답 타입 (NextResponse를 반환해 호출부에서 early return 가능)
export type AuthError = NextResponse;

/**
 * API Route에서 반복되는 Supabase 인증 패턴을 캡슐화합니다.
 *
 * 사용 예시:
 * ```ts
 * const auth = await requireAuth();
 * if (auth instanceof NextResponse) return auth; // 401 즉시 반환
 * const { user, supabase } = auth;
 * ```
 *
 * @returns AuthResult (user + supabase 클라이언트) 또는 401 NextResponse
 */
export async function requireAuth(): Promise<AuthResult | AuthError> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: '로그인이 필요합니다', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  return { user, supabase };
}

/**
 * requireAuth() 결과가 인증 성공인지 타입 가드로 판별합니다.
 *
 * 사용 예시:
 * ```ts
 * const auth = await requireAuth();
 * if (!isAuthResult(auth)) return auth;
 * ```
 */
export function isAuthResult(result: AuthResult | AuthError): result is AuthResult {
  return !(result instanceof NextResponse);
}
