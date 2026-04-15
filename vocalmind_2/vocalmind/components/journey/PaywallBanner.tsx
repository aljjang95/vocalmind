'use client';

import { useRouter } from 'next/navigation';
import { useJourneyStore } from '@/stores/journeyStore';
import { GlowCard } from '@/components/ui/glow-card';
import { Button } from '@/components/ui/button';

interface PaywallBannerProps {
  currentStage: number;
}

export default function PaywallBanner({ currentStage }: PaywallBannerProps) {
  const router = useRouter();
  const { userTier } = useJourneyStore();

  if (currentStage <= 18 || userTier !== 'free') return null;

  return (
    <div className="my-6">
      <GlowCard active glow className="p-6">
        <div className="flex flex-col gap-5">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)]">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </div>

          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] m-0 leading-snug">19단계부터는 발성전문반에서 진행돼요</h3>
            <p className="text-sm text-[var(--warning,#e5a136)] font-medium m-0 leading-normal">세팅 없이 고음 가면 목 상합니다</p>
          </div>

          <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
            <li className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] leading-snug">
              <span className="w-5 h-5 rounded-md bg-[var(--accent-muted,rgba(99,102,241,0.15))] flex items-center justify-center shrink-0 text-[var(--accent)]">
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              세팅 → 고음 → 가창까지 28단계 체계 코스
            </li>
            <li className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] leading-snug">
              <span className="w-5 h-5 rounded-md bg-[var(--accent-muted,rgba(99,102,241,0.15))] flex items-center justify-center shrink-0 text-[var(--accent)]">
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              4축 긴장 분석 (후두/혀뿌리/턱/성구전환)
            </li>
            <li className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] leading-snug">
              <span className="w-5 h-5 rounded-md bg-[var(--accent-muted,rgba(99,102,241,0.15))] flex items-center justify-center shrink-0 text-[var(--accent)]">
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              일간 + 주간 성장 리포트 + 맞춤 커리큘럼
            </li>
          </ul>

          <div className="flex items-baseline gap-1">
            <span className="font-mono text-[28px] font-bold text-[var(--text-primary)] tracking-tight">150,000원</span>
            <span className="text-[13px] text-[var(--text-muted)]">/ 월</span>
          </div>

          <Button variant="default" className="w-full" onClick={() => router.push('/pricing')}>
            발성전문반 시작하기
          </Button>
        </div>
      </GlowCard>
    </div>
  );
}
