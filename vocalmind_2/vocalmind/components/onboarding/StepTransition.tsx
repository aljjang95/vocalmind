'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export default function StepTransition() {
  const router = useRouter();
  const { result, selectedPlan, saveToSupabase } = useOnboardingStore();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const suggestedStage = result?.consultation.suggested_stage_id ?? 1;
  const plan = selectedPlan ?? 'free';

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user && result && !saved) {
        saveToSupabase().then(() => setSaved(true));
      }
    });
  }, [result, saved, saveToSupabase]);

  const getDestination = () => {
    if (plan === 'hobby') return '/hobby';
    if (plan === 'pro') return `/journey/${suggestedStage}`;
    return '/dashboard';
  };

  const handleStart = () => {
    const dest = getDestination();
    if (user) {
      if (plan !== 'free') {
        router.push(`/checkout/${plan}`);
      } else {
        router.push(dest);
      }
    } else {
      router.push(`/auth/signup?next=${encodeURIComponent(dest)}&plan=${plan}`);
    }
  };

  const planLabels: Record<string, string> = {
    hobby: '취미반',
    pro: '발성전문반',
    free: '무료',
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] gap-6 text-center animate-[fadeIn_0.5s_ease-out]">
      <h3 className="font-['Inter',sans-serif] text-[1.6rem] font-bold">
        레슨을 시작할 준비가 됐어요
      </h3>
      <p className="text-[0.9rem] text-[var(--text2)] leading-relaxed max-w-[420px]">
        {plan === 'hobby' && '자유 곡 연습과 AI 피드백으로 즐겁게 시작하세요.'}
        {plan === 'pro' && `분석 결과를 바탕으로 Stage ${suggestedStage}부터 체계적으로 시작합니다.`}
        {plan === 'free' && '무료 체험으로 가볍게 둘러보세요.'}
      </p>

      <div className="px-7 py-4 bg-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.2)] rounded-[var(--r-xs)] text-[0.88rem] text-[var(--accent-lt)]">
        <div className="text-[0.78rem] text-[var(--text2)] mb-1">선택한 플랜</div>
        <div className="font-bold text-[1.1rem]">{planLabels[plan]}</div>
      </div>

      {!user && (
        <p className="text-[0.82rem] text-[var(--accent-lt)] bg-[rgba(59,130,246,0.04)] border border-[rgba(59,130,246,0.12)] rounded-lg px-4 py-2.5 max-w-[380px]">
          가입하면 분석 결과가 저장되고, 맞춤 커리큘럼으로 이어갑니다.
        </p>
      )}

      <div className="flex flex-col gap-3 w-full max-w-[320px]">
        <Button
          variant="default"
          size="lg"
          className="w-full"
          onClick={handleStart}
        >
          {user
            ? plan !== 'free' ? `${planLabels[plan]} 결제하기` : '시작하기'
            : '가입하고 시작하기'
          }
        </Button>
        <button
          type="button"
          className="bg-transparent border-none text-[var(--text2)] text-[0.85rem] font-[var(--font-sans)] cursor-pointer py-2 transition-colors duration-200 hover:text-[var(--text)]"
          onClick={() => router.push('/dashboard')}
        >
          나중에 선택하기
        </button>
      </div>
    </div>
  );
}
