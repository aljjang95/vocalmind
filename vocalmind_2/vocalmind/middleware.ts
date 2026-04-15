import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// 로그인 없이 접근 가능한 경로
const PUBLIC_PATHS = ['/', '/auth/login', '/auth/signup', '/auth/callback', '/scale-practice', '/journey', '/pricing', '/payment'];
// 선생님 전용 경로 (로그인 필요, 이메일 검사는 page.tsx/API에서 처리)
const TEACHER_PATHS = ['/teacher'];

export async function middleware(request: NextRequest) {
  // ── CSP nonce 생성 ──
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  const nonce = btoa(String.fromCharCode.apply(null, Array.from(array)));

  const isDev = process.env.NODE_ENV === 'development';
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.youtube.com blob:`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' https://www.youtube.com blob:`;
  const connectSrc = isDev
    ? `connect-src 'self' ws://localhost:* http://localhost:* https://*.supabase.co https://*.modal.run https://d1pzp51pvbm36p.cloudfront.net https://api.tosspayments.com blob:`
    : `connect-src 'self' wss://* https://*.supabase.co https://*.modal.run https://*.fly.dev https://d1pzp51pvbm36p.cloudfront.net https://api.tosspayments.com blob:`;
  const csp = [
    `default-src 'self'`, scriptSrc,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob: https://images.unsplash.com https://*.tosspayments.com https://i.ytimg.com https://lh3.googleusercontent.com https://k.kakaocdn.net https://img1.kakaocdn.net`,
    connectSrc,
    `media-src 'self' https://*.supabase.co blob:`,
    `frame-src https://js.tosspayments.com https://www.youtube.com https://accounts.google.com https://kauth.kakao.com`,
    `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self' https://accounts.google.com https://kauth.kakao.com`,
  ].join('; ');

  // ── Supabase 세션 갱신 ──
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) => {
            requestHeaders.set('cookie', `${name}=${value}`);
          });
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // ── 라우트 보호 ──
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) || pathname.startsWith('/auth/');
  const isApi = pathname.startsWith('/api/');

  if (!user && !isPublic && !isApi) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    loginUrl.searchParams.set('message', 'login_required');
    return NextResponse.redirect(loginUrl);
  }

  // 이메일 미인증 사용자 → 인증 안내 페이지로 (OAuth 사용자는 제외)
  const isOAuthUser = user?.app_metadata?.provider && user.app_metadata.provider !== 'email';
  if (user && !user.email_confirmed_at && !isOAuthUser && !pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/auth/verify-email', request.url));
  }

  // 로그인 상태에서 /auth/login 접근 → /dashboard로 리다이렉트
  if (user && (pathname === '/auth/login' || pathname === '/auth/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
