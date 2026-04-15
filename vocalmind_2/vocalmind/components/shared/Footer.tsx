import Link from 'next/link';
import { IconYoutube, IconInstagram, IconTiktok, IconTwitter } from '@/components/shared/Icons';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[var(--bg-base)] py-16 relative z-[1]">
      <div className="container">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-12 mb-12">
          <div className="col-span-1 sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 font-['Inter',sans-serif] text-base font-medium text-[var(--text)] no-underline">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-[10px] flex items-center justify-center relative overflow-hidden shadow-[0_4px_16px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]">
                <svg className="relative z-[1] drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" fill="url(#flgr)" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                  <line x1="12" y1="19" x2="12" y2="22" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="flgr" x1="9" y1="2" x2="15" y2="12">
                      <stop stopColor="#fff" />
                      <stop offset="1" stopColor="rgba(255,255,255,0.6)" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className="flex gap-1.5"><strong className="font-extrabold tracking-[0.02em] bg-gradient-to-br from-blue-400 to-purple-400 bg-clip-text text-transparent">HLB</strong> 보컬스튜디오</span>
            </Link>
            <p className="text-sm text-[var(--text-muted)] mt-3 max-w-[280px] leading-[1.7]">7년 경력 보컬 트레이너의 커리큘럼과 AI가 결합된 차세대 보컬 트레이닝 플랫폼입니다. 당신의 목소리가 가진 진짜 가능성을 깨워드립니다.</p>
          </div>

          <div className="flex flex-col">
            <h4 className="font-['JetBrains_Mono',monospace] text-[0.72rem] font-medium tracking-[0.12em] uppercase text-[var(--text-secondary)] mb-4">서비스</h4>
            <a href="#features" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-light)] transition-colors mb-2.5 no-underline">기능 소개</a>
            <a href="#how" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-light)] transition-colors mb-2.5 no-underline">사용 방법</a>
            <a href="#pricing" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-light)] transition-colors mb-2.5 no-underline">요금제</a>
            <a href="#demo" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-light)] transition-colors mb-2.5 no-underline">AI 체험</a>
          </div>

          <div className="flex flex-col">
            <h4 className="font-['JetBrains_Mono',monospace] text-[0.72rem] font-medium tracking-[0.12em] uppercase text-[var(--text-secondary)] mb-4">회사</h4>
            <a href="#" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-light)] transition-colors mb-2.5 no-underline">트레이너 소개</a>
            <a href="#" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-light)] transition-colors mb-2.5 no-underline">블로그</a>
            <a href="#" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-light)] transition-colors mb-2.5 no-underline">채용</a>
            <a href="#" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-light)] transition-colors mb-2.5 no-underline">문의하기</a>
          </div>

          <div className="flex flex-col">
            <h4 className="font-['JetBrains_Mono',monospace] text-[0.72rem] font-medium tracking-[0.12em] uppercase text-[var(--text-secondary)] mb-4">법적 고지</h4>
            <a href="#" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-light)] transition-colors mb-2.5 no-underline">이용약관</a>
            <a href="#" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-light)] transition-colors mb-2.5 no-underline">개인정보처리방침</a>
            <a href="#" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-light)] transition-colors mb-2.5 no-underline">쿠키 정책</a>
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 pt-7 border-t border-white/[0.06]">
          <p className="text-xs text-[var(--text-dim)]">&copy; 2026 HLB 보컬스튜디오. All rights reserved.</p>
          <div className="flex gap-2.5">
            <a className="w-9 h-9 bg-white/[0.04] border border-white/[0.06] rounded-lg flex items-center justify-center no-underline text-[var(--text-secondary)] hover:bg-[var(--accent)]/20 hover:border-white/[0.12] transition-colors" href="#" title="YouTube" aria-label="YouTube"><IconYoutube size={16} /></a>
            <a className="w-9 h-9 bg-white/[0.04] border border-white/[0.06] rounded-lg flex items-center justify-center no-underline text-[var(--text-secondary)] hover:bg-[var(--accent)]/20 hover:border-white/[0.12] transition-colors" href="#" title="Instagram" aria-label="Instagram"><IconInstagram size={16} /></a>
            <a className="w-9 h-9 bg-white/[0.04] border border-white/[0.06] rounded-lg flex items-center justify-center no-underline text-[var(--text-secondary)] hover:bg-[var(--accent)]/20 hover:border-white/[0.12] transition-colors" href="#" title="TikTok" aria-label="TikTok"><IconTiktok size={16} /></a>
            <a className="w-9 h-9 bg-white/[0.04] border border-white/[0.06] rounded-lg flex items-center justify-center no-underline text-[var(--text-secondary)] hover:bg-[var(--accent)]/20 hover:border-white/[0.12] transition-colors" href="#" title="Twitter" aria-label="Twitter"><IconTwitter size={16} /></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
