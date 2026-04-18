import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/journey';

  if (code) {
    const response = NextResponse.redirect(new URL(next, request.url));

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    console.error('[auth/callback] exchangeCodeForSession failed:', error.message, error);
  }

  const errorParam = searchParams.get('error_description') || searchParams.get('error') || 'auth_failed';
  console.error('[auth/callback] OAuth error:', { error: searchParams.get('error'), description: searchParams.get('error_description') });
  return NextResponse.redirect(new URL(`/auth/login?error=auth_failed&detail=${encodeURIComponent(errorParam)}`, request.url));
}
