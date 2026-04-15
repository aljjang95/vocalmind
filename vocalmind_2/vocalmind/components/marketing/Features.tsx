'use client';

import { useScrollReveal } from '@/lib/hooks/useScrollReveal';
import { GlowCard } from '@/components/ui/glow-card';

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/>
        <path d="M19 10v2a7 7 0 01-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
      </svg>
    ),
    kicker: '핵심 기술',
    title: '4축 긴장 감지',
    desc: '후두·혀뿌리·턱·성구전환 — 4개 부위의 긴장을 실시간으로 측정합니다. "목이 조인다"는 느낌의 정확한 원인을 수치로 보여줍니다.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M3 12h18M3 18h18"/>
        <circle cx="7" cy="6" r="1" fill="currentColor"/>
        <circle cx="7" cy="12" r="1" fill="currentColor"/>
        <circle cx="7" cy="18" r="1" fill="currentColor"/>
      </svg>
    ),
    kicker: '체계적 학습',
    title: '28단계 커리큘럼',
    desc: '이완 기초 → 호흡/허밍 → 모음/자음 → 세팅 훈련 → 두성/연결 → 고음/표현 → 실가창. 7년 경력 트레이너의 레슨 순서 그대로입니다.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="6" width="20" height="12" rx="2"/>
        <path d="M7 6V4M12 6V4M17 6V4"/>
      </svg>
    ),
    kicker: '반복 훈련',
    title: '피아노 스케일 채점',
    desc: '그랜드 피아노 반주에 맞춰 노래하면, AI가 음정 정확도·음색 안정도·이완 상태를 3단계로 채점합니다. 통과해야 다음 단계로 해금됩니다.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
    ),
    kicker: '즉시 피드백',
    title: '24시간 AI 코치',
    desc: '레슨 예약 없이 지금 바로 질문하세요. 고음 안 나는 이유, 호흡 교정법, 오디션 준비까지 — 실제 트레이너의 답변 패턴으로 학습된 AI입니다.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
    kicker: '성장 추적',
    title: '세션별 성장 리포트',
    desc: '매 연습마다 음역대 변화, 평균 긴장도, 음정 오차(cents 단위)를 기록합니다. 한 달 전보다 얼마나 달라졌는지 수치로 확인할 수 있습니다.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
    ),
    kicker: '발성 진단',
    title: '발성 분석 리포트',
    desc: '노래 한 소절을 부르면 AI가 후두·혀뿌리·턱·성구전환 4축 긴장도를 수치로 측정합니다. 언제든 다시 분석해 변화를 추적하세요.',
  },
];

export default function Features() {
  const headRef = useScrollReveal<HTMLDivElement>();

  return (
    <section id="features" className="py-24">
      <div className="max-w-[1200px] mx-auto px-7">
        <div className="text-center mb-16" ref={headRef}>
          <div className="section-kicker">핵심 기능</div>
          <h2 className="font-[family-name:var(--font-display)] text-[var(--fs-h2)] text-[var(--text-primary)]">
            다른 앱과 다른 점 하나
          </h2>
          <p className="section-desc">
            &ldquo;잘 못하는 것&rdquo;을 말해주는 앱은 많습니다.
            HLB는 <strong>왜 안 되는지</strong>를 찾아서, 어떻게 고치는지 알려줍니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {FEATURES.map((f) => (
            <GlowCard key={f.title} className="p-8">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--accent-light)] mb-5" style={{ background: 'rgba(91,140,110,0.1)' }}>
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{f.title}</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{f.desc}</p>
            </GlowCard>
          ))}
        </div>
      </div>
    </section>
  );
}
