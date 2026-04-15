import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 서버 컴포넌트에서 쿠키 설정 시 무시 (Route Handler에서만 가능)
          }
        },
      },
    }
  );
}

// ── ⚠️ SERVICE ROLE KEY 사용 금지 구역 ─────────────────────────────────────
// 이 파일(server.ts)은 ANON_KEY + 사용자 세션 기반 RLS를 사용합니다.
// SUPABASE_SERVICE_ROLE_KEY는 RLS를 완전히 우회하므로:
//   ✗ 일반 API Route에서 절대 사용 금지
//   ✗ 클라이언트 번들에 절대 포함 금지
//   ✓ 별도의 lib/supabase/admin.ts 파일에서만 사용
//   ✓ 사용 사례: 마이그레이션, cron 작업, 어드민 전용 Route
// ─────────────────────────────────────────────────────────────────────────────
