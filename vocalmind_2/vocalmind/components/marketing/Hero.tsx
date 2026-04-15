'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScrollReveal } from '@/lib/hooks/useScrollReveal';
import { SoundWaveBackground } from '@/components/ui/sound-wave-bg';
import { createClient } from '@/lib/supabase/client';

export default function Hero() {
  const router = useRouter();
  const ref = useScrollReveal<HTMLDivElement>();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setLoggedIn(true);
    });
  }, []);

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <SoundWaveBackground />

      <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-base)] via-transparent to-[var(--bg-base)] z-[1]" />

      <div className="relative z-10 text-center max-w-4xl mx-auto px-7" ref={ref}>
        <h1 className="font-[family-name:var(--font-display)] text-[clamp(2.75rem,5vw,4rem)] font-light text-[var(--text-primary)] leading-[1.05] tracking-[-0.03em]">
          목이 조이는 이유,
          <br />
          <em
            className="not-italic text-[var(--accent-light)]"
            style={{ textShadow: '0 0 30px rgba(80,180,120,0.4)' }}
          >
            이제 알 수 있습니다
          </em>
        </h1>

        <p className="text-base md:text-lg text-[var(--text-secondary)] mt-6 max-w-2xl mx-auto leading-relaxed">
          후두·혀뿌리·턱의 긴장을 AI가 실시간으로 분석합니다.{' '}
          <br className="hidden md:inline" />
          원인을 알면, 달라집니다.
        </p>

        <a
          href={loggedIn ? '/onboarding' : '/auth/login?next=/onboarding'}
          onClick={(e) => {
            e.preventDefault();
            router.push(loggedIn ? '/onboarding' : '/auth/login?next=/onboarding');
          }}
          className="mt-10 inline-flex items-center gap-2 bg-[var(--accent)] text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-[0_0_40px_var(--accent-glow)] hover:shadow-[0_0_60px_var(--accent-glow)] hover:bg-[var(--accent-hover)] transition-all"
        >
          무료 상담 시작하기
        </a>

        <p className="mt-4 text-sm text-[var(--text-muted)]">
          카드 등록 없이 무료로 시작
        </p>
      </div>
    </section>
  );
}
