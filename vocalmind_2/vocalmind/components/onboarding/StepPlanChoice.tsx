'use client';

import { useOnboardingStore } from '@/stores/onboardingStore';
import type { Plan } from '@/types';

const PLANS: Array<{
  plan: Plan;
  title: string;
  subtitle: string;
  price: string;
  features: string[];
  recommended?: boolean;
}> = [
  {
    plan: 'hobby',
    title: '취미반',
    subtitle: '부르면서 자유롭게 배우고 싶어요',
    price: '100,000원/월',
    features: [
      '자유 곡 실시간 평가 + AI 피드백',
      'HLB 커리큘럼 맛보기 (5단계)',
      'AI 보컬 지식 종합 코칭',
      'AI 커버 + 목소리 클론',
    ],
  },
  {
    plan: 'pro',
    title: '발성전문반',
    subtitle: '체계적으로 처음부터 배우고 싶어요',
    price: '150,000원/월',
    features: [
      '취미반 전부 포함',
      '28단계 HLB 체계적 커리큘럼',
      '5-phase 레슨 + 채점 해금',
      '4축 긴장 분석 + 성장 리포트',
    ],
    recommended: true,
  },
  {
    plan: 'free',
    title: '무료',
    subtitle: '일단 둘러볼게요',
    price: '무료',
    features: [
      '3단계까지 체험',
      '피아노 스케일 연습',
      '기본 긴장 감지',
    ],
  },
];

export default function StepPlanChoice() {
  const { setStep, setSelectedPlan } = useOnboardingStore();

  const handleSelect = (plan: Plan) => {
    setSelectedPlan(plan);
    setStep(5);
  };

  return (
    <div className="flex flex-col items-center gap-6 py-4 animate-[slideIn_0.4s_ease-out]">
      <h3 className="font-['Inter',sans-serif] text-[1.4rem] font-bold text-center">
        어떻게 시작할까요?
      </h3>
      <p className="text-[0.9rem] text-[var(--text2)] text-center leading-relaxed max-w-[480px]">
        분석 결과에 맞는 플랜을 선택하세요. 언제든 변경할 수 있습니다.
      </p>

      <div className="flex flex-col gap-4 w-full max-w-[480px]">
        {PLANS.map(({ plan, title, subtitle, price, features, recommended }) => (
          <button
            key={plan}
            type="button"
            onClick={() => handleSelect(plan)}
            className={`relative text-left w-full p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer bg-transparent ${
              recommended
                ? 'border-[var(--accent)] shadow-[0_0_16px_rgba(59,130,246,0.12)]'
                : 'border-[var(--border)] hover:border-[var(--border2)]'
            }`}
          >
            {recommended && (
              <span className="absolute -top-2.5 right-4 text-[10px] font-semibold text-white bg-[var(--accent)] px-2.5 py-0.5 rounded">
                추천
              </span>
            )}
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-bold text-[var(--text-primary)]">{title}</span>
              <span className="text-sm font-semibold text-[var(--accent-light)]">{price}</span>
            </div>
            <p className="text-[0.82rem] text-[var(--text-secondary)] mb-3">{subtitle}</p>
            <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-[0.8rem] text-[var(--text-secondary)]">
                  <svg className="text-[var(--accent-light)] shrink-0" width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  );
}
