'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useJourneyStore } from '@/stores/journeyStore';
import { useToastStore } from '@/stores/toastStore';
import type { User } from '@supabase/supabase-js';

export default function Nav() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const showToast = useToastStore((s) => s.show);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });

    const supabase = createClient();
    supabase.auth.getUser()
      .then(({ data }) => setUser(data.user))
      .catch(() => setUser(null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const prev = user;
      setUser(session?.user ?? null);
      // 로그인 성공 알림 (이전에 비로그인 → 로그인 전환)
      if (event === 'SIGNED_IN' && !prev && session?.user) {
        showToast('로그인되었습니다.', 'success');
      }
    });

    return () => { window.removeEventListener('scroll', onScroll); subscription.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const blockedTargets = Array.from(document.querySelectorAll<HTMLElement>('main, footer'));
    const menuButton = menuButtonRef.current;

    if (menuOpen) {
      document.body.style.overflow = 'hidden';
      blockedTargets.forEach((target) => {
        target.setAttribute('aria-hidden', 'true');
        target.setAttribute('inert', '');
      });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      blockedTargets.forEach((target) => {
        target.removeAttribute('aria-hidden');
        target.removeAttribute('inert');
      });
      window.removeEventListener('keydown', onKeyDown);
      if (menuOpen) menuButton?.focus();
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    showToast('로그아웃되었습니다.', 'info');
    router.push('/');
    router.refresh();
  };

  const onboardingResult = useOnboardingStore((s) => s.result);
  const userTier = useJourneyStore((s) => s.userTier);

  const navLinks = useMemo(() => {
    const hasOnboarding = !!onboardingResult;
    const isPaid = userTier === 'hobby' || userTier === 'pro' || userTier === 'teacher';

    // 항상 표시
    const links: { href: string; label: string }[] = [
      { href: '/journey', label: '소리의 길' },
      { href: '/community', label: '커뮤니티' },
      { href: '/audition', label: '오디션' },
      { href: '/pricing', label: '요금제' },
    ];

    // 온보딩 완료 후 추가
    if (hasOnboarding || user) {
      links.splice(1, 0,
        { href: '/scale-practice', label: '스케일 연습' },
        { href: '/coach', label: 'AI 코치' },
      );
    }

    // 유료 사용자 추가
    if (isPaid) {
      const insertIdx = links.findIndex(l => l.href === '/pricing');
      // 취미반: 자유 연습 메뉴
      if (userTier === 'hobby') {
        links.splice(1, 0, { href: '/hobby', label: '자유 연습' });
      }
      links.splice(insertIdx + (userTier === 'hobby' ? 1 : 0), 0,
        { href: '/ai-cover', label: 'AI 커버' },
        { href: '/vocal-report', label: '발성 분석' },
      );
    }

    return links;
  }, [onboardingResult, userTier, user]);

  const closeMenu = () => setMenuOpen(false);

  const navLinkClass = 'px-2.5 py-2 text-[var(--text2)] no-underline text-[0.82rem] font-normal rounded-lg transition-colors hover:text-[var(--text)] hover:bg-[var(--surface2)] whitespace-nowrap';
  const mobileLinkClass = "font-['Inter',sans-serif] text-[1.6rem] font-bold text-[var(--text)] no-underline transition-colors hover:text-[var(--accent)]";
  const ctaClass = '!px-6 !py-2.5 !bg-[var(--cta-bg)] !text-[var(--cta-text)] !font-semibold !rounded-[10px] !transition-all !shadow-[0_4px_20px_rgba(255,255,255,0.1)] hover:!-translate-y-px hover:!shadow-[0_8px_28px_rgba(255,255,255,0.15)] hover:!bg-[var(--cta-hover)]';

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-[200] py-5 bg-[var(--glass-bg)]/30 backdrop-blur-[8px] transition-all duration-[400ms] border-b border-transparent ${
          scrolled ? 'py-3.5 !bg-[var(--glass-bg)] !backdrop-blur-[30px] saturate-[180%] !border-[var(--border)]' : ''
        }`}
        id="mainNav"
      >
        <div className="max-w-[1200px] mx-auto px-7 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-['Inter',sans-serif] text-[1.1rem] font-medium text-[var(--text)] no-underline tracking-[-0.01em]">
            <div className="w-10 h-10 bg-gradient-to-br from-[#5B8C6E] to-[#3A6B50] rounded-xl flex items-center justify-center relative overflow-hidden shadow-[0_4px_16px_rgba(91,140,110,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]">
              <svg className="relative z-[1] drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]" width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" fill="url(#lgr)" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="12" y1="19" x2="12" y2="22" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                <defs>
                  <linearGradient id="lgr" x1="9" y1="2" x2="15" y2="12">
                    <stop stopColor="#fff" />
                    <stop offset="1" stopColor="rgba(255,255,255,0.6)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="flex gap-[5px]"><strong className="font-extrabold tracking-[0.02em] bg-gradient-to-br from-[#6EAA80] to-[#8CC6A0] bg-clip-text text-transparent">HLB</strong> 보컬스튜디오</span>
          </Link>

          <ul className="hidden min-[960px]:flex items-center gap-2 list-none flex-nowrap overflow-hidden">
            {navLinks.map((link) => (
              <li key={link.href}><Link href={link.href} className={navLinkClass}>{link.label}</Link></li>
            ))}
            {user && <li><Link href="/dashboard" className={navLinkClass}>대시보드</Link></li>}
            {user && <li><Link href="/avatar" className={navLinkClass}>내 아바타</Link></li>}
            {user && <li><Link href="/vocal-dna" className={navLinkClass}>음색 DNA</Link></li>}
            <li><ThemeToggle /></li>
            {user ? (
              <li><button onClick={handleLogout} className={`${ctaClass} border-none cursor-pointer`}>로그아웃</button></li>
            ) : (
              <li><Link href="/onboarding" className={`${ctaClass} no-underline`}>무료 상담</Link></li>
            )}
          </ul>

          <button
            ref={menuButtonRef}
            className="flex min-[960px]:hidden flex-col gap-[5px] cursor-pointer p-1.5 bg-transparent border-none"
            onClick={() => setMenuOpen(true)}
            aria-label="메뉴 열기"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <span className="block w-[22px] h-[1.5px] bg-[var(--text)] rounded-sm transition-all" />
            <span className="block w-[22px] h-[1.5px] bg-[var(--text)] rounded-sm transition-all" />
            <span className="block w-[22px] h-[1.5px] bg-[var(--text)] rounded-sm transition-all" />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        id="mobile-menu"
        className={`fixed inset-0 z-[300] bg-[var(--bg-base)]/97 backdrop-blur-[24px] flex-col items-center justify-center gap-[22px] ${
          menuOpen ? 'flex' : 'hidden'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="모바일 메뉴"
      >
        <button className="absolute top-[22px] right-[26px] bg-transparent border-none text-[var(--muted)] text-2xl cursor-pointer" onClick={closeMenu} aria-label="메뉴 닫기">✕</button>
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} onClick={closeMenu} className={mobileLinkClass}>{link.label}</Link>
        ))}
        {user && <Link href="/dashboard" onClick={closeMenu} className={mobileLinkClass}>대시보드</Link>}
        {user && <Link href="/avatar" onClick={closeMenu} className={mobileLinkClass}>내 아바타</Link>}
        {user && <Link href="/vocal-dna" onClick={closeMenu} className={mobileLinkClass}>음색 DNA</Link>}
        {user ? (
          <button onClick={() => { closeMenu(); handleLogout(); }} className="bg-transparent border-none cursor-pointer text-[var(--text)] font-['Inter',sans-serif] text-[1.6rem] font-bold p-0 text-left transition-colors hover:text-[var(--accent)]">로그아웃</button>
        ) : (
          <Link href="/onboarding" onClick={closeMenu} className={mobileLinkClass}>무료 상담</Link>
        )}
      </div>
    </>
  );
}
