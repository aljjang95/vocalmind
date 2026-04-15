'use client';

import { useBillingStore } from '@/stores/billingStore';

export default function UsageCounter() {
  const { plan, apiUsageWon, getApiLimit } = useBillingStore();
  const limit = getApiLimit();

  if (plan === 'free') {
    return (
      <div className="bg-amber-500/[0.08] border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
        <p className="text-[0.85rem] text-amber-300">
          무료 플랜에서는 내장 파일만 사용 가능합니다.
          유료 플랜으로 업그레이드하면 본인 파일로 AI 커버를 만들 수 있습니다.
        </p>
      </div>
    );
  }

  const pct = limit > 0 ? Math.min((apiUsageWon / limit) * 100, 100) : 0;
  const isNearLimit = apiUsageWon >= limit * 0.8;
  const isOver = apiUsageWon >= limit;

  return (
    <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl px-4 py-3 mb-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[0.85rem] text-[var(--text-secondary)]">이번 달 API 사용량</span>
        <span className={`text-[0.85rem] font-semibold ${isNearLimit ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>
          {apiUsageWon.toLocaleString()}원 / {limit.toLocaleString()}원
        </span>
      </div>
      <div className="h-1.5 bg-[var(--border)] rounded-sm overflow-hidden">
        <div
          className={`h-full rounded-sm transition-[width] duration-300 ${isNearLimit ? 'bg-red-500' : 'bg-purple-600'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isOver && (
        <p className="text-xs text-red-400 mt-2">
          이번 달 사용량을 모두 소진했습니다. 다음 달에 리셋됩니다.
        </p>
      )}
    </div>
  );
}
