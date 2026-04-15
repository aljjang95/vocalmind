'use client';

import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useState } from 'react';

export default function VerifyEmailPage() {
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      await supabase.auth.resend({ type: 'signup', email: user.email });
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] p-6">
      <div className="text-center max-w-[440px]">
        <div className="w-16 h-16 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center mx-auto mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>
        <h2 className="text-[var(--text-primary)] text-2xl font-bold mb-3">
          이메일 인증을 완료해주세요
        </h2>
        <p className="text-[var(--text-secondary)] text-[0.9375rem] leading-relaxed">
          가입 시 입력한 이메일로 인증 링크를 보냈습니다.<br/>
          링크를 클릭하면 서비스를 이용할 수 있습니다.
        </p>
        <div className="flex flex-col gap-3 mt-8">
          <button
            onClick={handleResend}
            disabled={sent}
            className="py-3 px-8 rounded-xl bg-[var(--accent)] text-white font-medium border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sent ? '인증 메일을 보냈습니다' : '인증 메일 다시 보내기'}
          </button>
          <Link
            href="/auth/login"
            className="py-3 px-8 rounded-xl border border-white/10 text-white/70 no-underline text-sm hover:border-white/20 transition-colors"
          >
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
