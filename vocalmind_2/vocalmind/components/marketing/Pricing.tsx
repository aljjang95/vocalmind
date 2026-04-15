'use client';

import { useRouter } from 'next/navigation';
import { GlowCard } from '@/components/ui/glow-card';

export default function Pricing() {
  const router = useRouter();

  const goCheckout = (plan: string) => router.push(`/checkout/${plan}`);
  const goOnboarding = () => router.push('/onboarding');

  return (
    <section id="pricing" className="py-24">
      <div className="max-w-[1200px] mx-auto px-7">
        <div className="text-center mb-14">
          <div className="section-kicker" style={{ justifyContent: 'center' }}>요금제</div>
          <h2 className="section-title" style={{ textAlign: 'center' }}>
            오프라인 레슨 그대로,<br />온라인으로
          </h2>
          <p className="text-[15px] text-[var(--text-secondary)] text-center mt-3 leading-relaxed">
            사설 레슨 1회 평균 5만원. 발성전문반은 한 달 내내 AI 코칭.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-start">
          {/* 무료 */}
          <GlowCard className="p-8 flex flex-col">
            <div className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">무료</div>
            <p className="text-[13px] text-[var(--text-muted)] mt-0 mb-5 leading-normal">가볍게 시작하기</p>
            <div className="flex items-baseline gap-0.5 mb-0.5">
              <span className="text-3xl font-mono font-bold text-[var(--text-primary)]">무료</span>
            </div>
            <div className="text-sm text-[var(--text-muted)] mb-5">광고 포함</div>
            <div className="h-px bg-[var(--border-subtle)] mb-5" />
            <ul className="list-none p-0 m-0 mb-6 flex flex-col gap-2.5 flex-1">
              <Feature on>무료 상담 1회 + 기본 체험</Feature>
              <Feature on>3단계까지 채점 기반 진행</Feature>
              <Feature on>피아노 스케일 연습</Feature>
              <Feature on>기본 긴장 감지</Feature>
              <Feature on>AI 커버 (내장 파일만)</Feature>
              <Feature on note>광고 포함</Feature>
              <Feature off>자유 곡 업로드</Feature>
              <Feature off>AI 커버 API</Feature>
            </ul>
            <button
              onClick={goOnboarding}
              className="mt-auto pt-6 w-full py-2.5 rounded-lg font-medium transition-colors border border-white/[0.10] text-[var(--text-secondary)] hover:bg-white/[0.04]"
            >
              무료 상담 시작하기
            </button>
          </GlowCard>

          {/* 취미반 */}
          <GlowCard className="p-8 flex flex-col">
            <div className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">취미반</div>
            <p className="text-[13px] text-[var(--text-muted)] mt-0 mb-5 leading-normal">자유롭게 노래하며 배우기</p>
            <div className="flex items-baseline gap-0.5 mb-0.5">
              <span className="text-base font-medium text-[var(--text-secondary)]">{'\u20A9'}</span>
              <span className="text-3xl font-mono font-bold text-[var(--text-primary)]">100,000</span>
            </div>
            <div className="text-sm text-[var(--text-muted)] mb-5">/ 월</div>
            <div className="h-px bg-[var(--border-subtle)] mb-5" />
            <ul className="list-none p-0 m-0 mb-6 flex flex-col gap-2.5 flex-1">
              <Feature on>자유 곡 실시간 평가 + AI 피드백</Feature>
              <Feature on>HLB 커리큘럼 맛보기 (5단계)</Feature>
              <Feature on>AI 보컬 지식 종합 코칭</Feature>
              <Feature on>AI 커버 (본인 파일, 5,000원/월)</Feature>
              <Feature on>목소리 클론</Feature>
              <Feature on>광고 제거</Feature>
              <Feature off>28단계 체계적 커리큘럼</Feature>
              <Feature off>4축 긴장 상세 분석</Feature>
            </ul>
            <button
              onClick={() => goCheckout('hobby')}
              className="mt-auto pt-6 w-full py-2.5 rounded-lg font-medium transition-colors border border-white/[0.10] text-[var(--text-secondary)] hover:bg-white/[0.04]"
            >
              취미반 시작
            </button>
          </GlowCard>

          {/* 발성전문반 */}
          <GlowCard active className="p-8 flex flex-col relative">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-white bg-[var(--accent)] px-3 py-0.5 rounded">
              추천
            </span>
            <div className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">발성전문반</div>
            <p className="text-[13px] text-[var(--text-muted)] mt-0 mb-5 leading-normal">발성 매커니즘 기반, 체계적 성장</p>
            <div className="flex items-baseline gap-0.5 mb-0.5">
              <span className="text-base font-medium text-[var(--text-secondary)]">{'\u20A9'}</span>
              <span className="text-3xl font-mono font-bold text-[var(--text-primary)]">150,000</span>
            </div>
            <div className="text-sm text-[var(--text-muted)] mb-5">/ 월</div>
            <div className="h-px bg-[var(--border-subtle)] mb-5" />
            <ul className="list-none p-0 m-0 mb-6 flex flex-col gap-2.5 flex-1">
              <Feature on>취미반 전부 포함</Feature>
              <Feature on>28단계 HLB 체계적 커리큘럼</Feature>
              <Feature on>5-phase 레슨 (왜?-시범-실습-평가-요약)</Feature>
              <Feature on>카메라/녹음 발성 체크</Feature>
              <Feature on>4축 긴장 분석 (후두/혀뿌리/턱/성구)</Feature>
              <Feature on>성장 리포트 + 맞춤 루틴</Feature>
              <Feature on>AI 커버 (본인 파일, 10,000원/월)</Feature>
            </ul>
            <button
              onClick={() => goCheckout('pro')}
              className="mt-auto pt-6 w-full py-2.5 rounded-lg font-medium transition-colors bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
            >
              발성전문반 시작
            </button>
          </GlowCard>

          {/* 유료 피드백 */}
          <GlowCard className="p-8 flex flex-col">
            <div className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wider">유료 피드백</div>
            <p className="text-[13px] text-[var(--text-muted)] mt-0 mb-5 leading-normal">선생님이 직접 듣고 진단</p>
            <div className="flex items-baseline gap-0.5 mb-0.5">
              <span className="text-base font-medium text-[var(--text-secondary)]">{'\u20A9'}</span>
              <span className="text-3xl font-mono font-bold text-[var(--text-primary)]">50,000</span>
            </div>
            <div className="text-sm text-[var(--text-muted)] mb-5">/ 1회</div>
            <div className="h-px bg-[var(--border-subtle)] mb-5" />
            <ul className="list-none p-0 m-0 mb-6 flex flex-col gap-2.5 flex-1">
              <Feature on>녹음 제출 - 선생님 직접 청취</Feature>
              <Feature on>AI 진단 + 선생님 소견 비교</Feature>
              <Feature on>구체적 개선 방향 제시</Feature>
              <Feature on>7년 경력 전문 트레이너</Feature>
              <Feature on>모든 플랜에서 추가 구매 가능</Feature>
            </ul>
            <button
              onClick={() => goCheckout('feedback')}
              className="mt-auto pt-6 w-full py-2.5 rounded-lg font-medium transition-colors border border-white/[0.10] text-[var(--text-secondary)] hover:bg-white/[0.04]"
            >
              피드백 신청
            </button>
          </GlowCard>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)] mt-8">
          취미반 · 발성전문반은 언제든 해지 가능 · 유료 피드백은 건당 결제
        </p>
      </div>
    </section>
  );
}

function Feature({ on, off, note, children }: {
  on?: boolean; off?: boolean; note?: boolean; children: React.ReactNode;
}) {
  const included = on && !off;
  return (
    <li className={`flex items-center gap-2 text-sm text-[var(--text-secondary)] ${!included ? 'text-[var(--text-muted)] opacity-50' : ''}`}>
      {included ? (
        <svg className="text-[var(--accent-light)] flex-shrink-0" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg className="text-[var(--text-muted)] flex-shrink-0 opacity-40" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      )}
      <span className={note ? 'text-[var(--text-muted)] italic' : ''}>{children}</span>
    </li>
  );
}
