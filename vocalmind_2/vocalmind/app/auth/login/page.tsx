'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useToastStore } from '@/stores/toastStore';

// URL 파라미터 → 사용자 메시지 매핑
const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: '인증에 실패했습니다. 다시 시도해주세요.',
  session_expired: '세션이 만료되었습니다. 다시 로그인해주세요.',
};
const INFO_MESSAGES: Record<string, string> = {
  login_required: '로그인이 필요한 페이지입니다.',
  logged_out: '로그아웃되었습니다.',
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') ?? '/journey';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const showToast = useToastStore((s) => s.show);

  // URL 파라미터에서 에러/메시지 읽어서 표시
  useEffect(() => {
    const urlError = searchParams.get('error');
    const urlMessage = searchParams.get('message');
    if (urlError && ERROR_MESSAGES[urlError]) {
      setError(ERROR_MESSAGES[urlError]);
    }
    if (urlMessage && INFO_MESSAGES[urlMessage]) {
      showToast(INFO_MESSAGES[urlMessage], 'info');
    }
  }, [searchParams, showToast]);

  const handleOAuth = async (provider: 'google' | 'kakao') => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        ...(provider === 'kakao' && { scopes: 'profile_nickname profile_image account_email' }),
      },
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? '이메일 또는 비밀번호가 올바르지 않습니다.'
        : authError.message);
      setLoading(false);
      return;
    }

    router.push(nextPath.startsWith('/') ? nextPath : '/journey');
    router.refresh();
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-[var(--bg-base)]">
      {/* 브랜딩 */}
      <div className="hidden md:flex flex-col justify-center p-16 bg-gradient-to-br from-[var(--bg-raised)] via-[var(--bg-elevated)] to-[var(--bg-raised)] relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[radial-gradient(circle,rgba(91,140,110,0.15)_0%,transparent_70%)]" />
        <div className="absolute -bottom-[60px] -left-[60px] w-60 h-60 rounded-full bg-[radial-gradient(circle,rgba(110,170,128,0.12)_0%,transparent_70%)]" />
        <div className="relative z-10">
          <div className="text-[0.8rem] tracking-[0.15em] text-[var(--accent-bright)]/70 uppercase mb-4">HLB 보컬스튜디오</div>
          <h1 className="text-[2.5rem] font-extrabold text-white leading-[1.2] mb-6">
            목이 조이는 이유,<br />
            <span className="text-[var(--accent-light)]">이제 알 수 있습니다</span>
          </h1>
          <p className="text-base text-white/[0.55] leading-[1.7] max-w-[360px]">
            후두·혀뿌리·턱의 긴장을 AI가 실시간으로 분석하고,
            당신만의 발성 로드맵을 제시합니다.
          </p>

          <div className="mt-12 flex flex-col gap-4">
            {[
              { label: '28단계', desc: '체계적 커리큘럼' },
              { label: '4축 분석', desc: '후두·혀뿌리·턱·성구' },
              { label: '18단계 무료', desc: '신용카드 불필요' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-[10px] shrink-0 bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-xs font-bold text-[var(--accent-light)]">
                  {item.label.replace(/[가-힣·]/g, '').trim() || item.label.slice(0, 2)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{item.label}</div>
                  <div className="text-xs text-white/40">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 폼 */}
      <div className="flex flex-col justify-start pt-16 md:justify-center items-center px-6 md:p-16">
        <div className="w-full max-w-[380px] md:max-w-[380px]">
          <h2 className="text-[1.75rem] font-bold text-white mb-2">로그인</h2>
          <p className="text-sm text-[var(--text-muted)] mb-8">계속하려면 로그인하세요</p>

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
              Google로 계속하기
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
              카카오로 계속하기
            </button>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-xs text-[var(--text-muted)]">또는 이메일로</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="block text-[0.8rem] font-medium text-[var(--text-secondary)] mb-2 tracking-[0.05em]">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full py-3.5 px-4 rounded-xl border border-white/[0.08] bg-white/[0.04] text-white text-[0.9375rem] outline-none focus:border-[var(--accent)]/60 transition-colors"
                placeholder="vocal@example.com"
              />
            </div>

            <div>
              <label className="block text-[0.8rem] font-medium text-[var(--text-secondary)] mb-2 tracking-[0.05em]">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-xl border-none text-white text-[0.9375rem] font-semibold mt-1 transition-colors ${
                loading
                  ? 'bg-[var(--bg-elevated)] cursor-not-allowed'
                  : 'bg-[var(--accent)] cursor-pointer hover:bg-[var(--accent-hover)]'
              }`}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="text-center mt-6 text-[var(--text-muted)] text-sm">
            계정이 없으신가요?{' '}
            <Link href={`/auth/signup?next=${encodeURIComponent(nextPath)}`} className="text-[var(--accent-light)] no-underline font-medium">
              무료로 시작하기
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
