'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleOAuth = async (provider: 'google' | 'kakao') => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback${nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ''}`,
        ...(provider === 'kakao' && { scopes: 'profile_nickname profile_image account_email' }),
      },
    });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/auth/callback${nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ''}`,
      },
    });

    if (authError) {
      setError(authError.message === 'User already registered'
        ? '이미 가입된 이메일입니다.'
        : authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-6">
        <div className="text-center max-w-[440px]">
          <div className="w-16 h-16 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="2">
              <path d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7"/>
              <path d="M2 13l10 8 10-8"/>
            </svg>
          </div>
          <h2 className="text-white text-2xl font-bold mb-3">
            이메일을 확인해주세요
          </h2>
          <p className="text-[var(--text-muted)] text-[0.9375rem] leading-relaxed">
            <span className="text-[var(--accent-light)] font-medium">{email}</span>로<br />
            인증 링크를 보냈습니다.
          </p>
          <Link href="/auth/login" className="inline-block mt-8 py-3 px-8 rounded-xl border border-white/10 text-white/70 no-underline text-sm">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-[var(--bg-base)]">
      {/* 브랜딩 */}
      <div className="hidden md:flex flex-col justify-center p-16 bg-gradient-to-br from-[var(--bg-raised)] via-[var(--bg-elevated)] to-[var(--bg-raised)] relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[radial-gradient(circle,rgba(91,140,110,0.15)_0%,transparent_70%)]" />
        <div className="absolute -bottom-[60px] -left-[60px] w-60 h-60 rounded-full bg-[radial-gradient(circle,rgba(110,170,128,0.12)_0%,transparent_70%)]" />
        <div className="relative z-10">
          <div className="text-[0.8rem] tracking-[0.15em] text-[var(--accent-bright)]/70 uppercase mb-4">HLB 보컬스튜디오</div>
          <h1 className="text-[2.5rem] font-extrabold text-white leading-[1.2] mb-6">
            목소리의 변화를,<br />
            <span className="text-[var(--accent-light)]">직접 느껴보세요</span>
          </h1>
          <p className="text-base text-white/[0.55] leading-[1.7] max-w-[360px]">
            18단계까지 무료. 신용카드 불필요.<br />
            AI 코치와 함께 지금 바로 시작하세요.
          </p>

          <div className="mt-12 p-6 rounded-xl bg-white/[0.04] border border-white/[0.07]">
            <div className="text-xs tracking-[0.08em] text-white/[0.35] uppercase mb-4">
              무료 플랜 포함
            </div>
            {[
              '18단계 레슨 채점 진행',
              'AI 발성 4축 분석',
              '스케일 피아노 자율 연습',
              '기본 긴장 감지',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 mb-2.5">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                  <circle cx="8" cy="8" r="7.5" stroke="rgba(91,140,110,0.4)" />
                  <path d="M5 8l2 2 4-4" stroke="var(--accent-light)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="text-sm text-white/65">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 폼 */}
      <div className="flex flex-col justify-start pt-16 md:justify-center items-center px-6 md:p-16">
        <div className="w-full max-w-full md:max-w-[380px]">
          <h2 className="text-[1.75rem] font-bold text-white mb-2">무료로 시작하기</h2>
          <p className="text-sm text-[var(--text-muted)] mb-8">계정을 만들면 바로 레슨을 시작합니다</p>

          {/* 소셜 로그인 */}
          <div className="flex flex-col gap-3 mb-6">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              className="w-full py-3.5 px-4 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white text-[0.9375rem] font-medium flex items-center justify-center gap-3 cursor-pointer hover:bg-white/[0.08] transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google로 시작하기
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('kakao')}
              className="w-full py-3.5 px-4 rounded-xl border-none text-[#191919] text-[0.9375rem] font-medium flex items-center justify-center gap-3 cursor-pointer hover:brightness-95 transition-all"
              style={{ backgroundColor: '#FEE500' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.62 1.75 4.93 4.38 6.24l-1.12 4.16c-.1.36.3.65.62.45l4.84-3.2c.42.04.85.07 1.28.07 5.52 0 10-3.36 10-7.72S17.52 3 12 3z" fill="#191919"/>
              </svg>
              카카오로 시작하기
            </button>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-xs text-[var(--text-muted)]">또는 이메일로</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          <form onSubmit={handleSignup} className="flex flex-col gap-5">
            <div>
              <label className="block text-[0.8rem] font-medium text-[var(--text-secondary)] mb-2 tracking-[0.05em]">
                이름
              </label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)} required
                className="w-full py-3.5 px-4 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white text-[0.9375rem] outline-none focus:border-[var(--accent)]/60 transition-colors"
                placeholder="홍길동"
              />
            </div>

            <div>
              <label className="block text-[0.8rem] font-medium text-[var(--text-secondary)] mb-2 tracking-[0.05em]">
                이메일
              </label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full py-3.5 px-4 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white text-[0.9375rem] outline-none focus:border-[var(--accent)]/60 transition-colors"
                placeholder="vocal@example.com"
              />
            </div>

            <div>
              <label className="block text-[0.8rem] font-medium text-[var(--text-secondary)] mb-2 tracking-[0.05em]">
                비밀번호
              </label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="w-full py-3.5 px-4 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white text-[0.9375rem] outline-none focus:border-[var(--accent)]/60 transition-colors"
                placeholder="6자 이상"
              />
            </div>

            {error && (
              <div className="py-3 px-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              className={`w-full py-3.5 rounded-xl border-none text-white text-[0.9375rem] font-semibold mt-1 transition-colors ${
                loading
                  ? 'bg-[var(--bg-elevated)] cursor-not-allowed'
                  : 'bg-[var(--accent)] cursor-pointer hover:bg-[var(--accent-hover)]'
              }`}
            >
              {loading ? '가입 중...' : '무료로 시작하기'}
            </button>
          </form>

          <p className="text-center mt-6 text-[var(--text-muted)] text-sm">
            이미 계정이 있으신가요?{' '}
            <Link href={`/auth/login${nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ''}`} className="text-[var(--accent-light)] no-underline font-medium">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
