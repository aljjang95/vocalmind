'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useScrollReveal } from '@/lib/hooks/useScrollReveal';
import { createClient } from '@/lib/supabase/client';

export default function CtaSection() {
  const router = useRouter();
  const ref = useScrollReveal<HTMLDivElement>();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setLoggedIn(true);
    });
  }, []);

  return (
    <section id="cta" className="py-32 text-center relative overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0" aria-hidden="true">
        <img
          src="https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=1920&q=80"
          alt=""
          loading="lazy"
          className="w-full h-full object-cover brightness-[0.2] saturate-[0.6]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(91,140,110,0.08),transparent_70%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-base)] via-transparent to-[var(--bg-base)]" style={{ backgroundSize: '100% 100%' }} />
      </div>

      {/* Accent gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--accent)]/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto px-7" ref={ref}>
        <h2 className="font-[family-name:var(--font-display)] text-[var(--fs-h1)] text-[var(--text-primary)]">
          지금 시작하세요
        </h2>
        <p className="text-lg text-[var(--text-secondary)] mt-4 max-w-[420px] mx-auto leading-relaxed">
          18단계까지 무료입니다. 당신의 목소리가 어떻게 변하는지 직접 경험하세요.
        </p>
        <button
          onClick={() => router.push(loggedIn ? '/onboarding' : '/auth/login?next=/onboarding')}
          className="mt-8 inline-flex items-center gap-2 bg-[var(--accent)] text-white px-10 py-4 rounded-xl text-lg font-semibold shadow-[0_0_60px_var(--accent-glow)] hover:shadow-[0_0_80px_var(--accent-glow)] transition-all animate-[ctaGlow_3s_infinite]"
        >
          무료 상담 시작하기
        </button>
      </div>
    </section>
  );
}
