import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { ToastContainer } from '@/components/ui/toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'HLB 보컬스튜디오 — 당신의 목소리를 깨워드립니다',
  description: '7년 경력 보컬 트레이너의 커리큘럼과 AI가 결합된 나만의 보컬 코치',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@300;400&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <ToastContainer />
        </ThemeProvider>
      </body>
    </html>
  );
}
