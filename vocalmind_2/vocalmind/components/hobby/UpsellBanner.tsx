'use client';

import Link from 'next/link';

export default function UpsellBanner() {
  return (
    <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.03] p-5 mt-6">
      <h4 className="text-sm font-semibold text-[var(--text-primary)]">
        더 빠르게 성장하고 싶다면?
      </h4>
      <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">
        발성전문반은 HLB 선생님의 체계적인 28단계 커리큘럼으로 진행됩니다.
        단계별 채점과 해금 시스템으로 확실한 실력 향상을 보장합니다.
      </p>
      <Link
        href="/checkout/pro"
        className="inline-block mt-3 text-sm text-[var(--accent-light)] font-medium no-underline hover:underline"
      >
        발성전문반 알아보기 &rarr;
      </Link>
    </div>
  );
}
