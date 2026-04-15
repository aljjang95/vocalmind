/** @type {import('next').NextConfig} */

// RISK-2: CSP nonce 패턴
// middleware.ts에서 요청마다 nonce를 생성하고 헤더로 전달합니다.
// next.config.js는 nonce를 모르므로 CSP 헤더를 여기서 직접 설정하지 않습니다.
// CSP는 middleware.ts → response.headers.set('Content-Security-Policy', ...) 에서 처리합니다.
// 참고: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // CSP는 middleware.ts에서 nonce와 함께 동적 설정됨 (이 파일에서는 제외)
          // Clickjacking 방어
          { key: 'X-Frame-Options', value: 'DENY' },
          // MIME 스니핑 방어
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Referrer 정보 최소화
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // HTTPS 강제 (Vercel 배포 시)
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
