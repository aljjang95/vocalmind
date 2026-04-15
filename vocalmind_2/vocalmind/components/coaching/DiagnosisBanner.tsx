'use client';

import Link from 'next/link';
import { useDiagnosisStore } from '@/stores/diagnosisStore';

export default function DiagnosisBanner() {
  const { result } = useDiagnosisStore();

  if (result) return null;

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.2)] rounded-[var(--r-sm)] max-[768px]:flex-col max-[768px]:text-center">
      <span className="text-[1.1rem] text-[var(--accent)] shrink-0">&#9432;</span>
      <p className="flex-1 text-[0.85rem] text-[var(--text2)]">
        먼저 <strong>보컬 진단</strong>을 받으면 맞춤 커리큘럼을 추천받을 수 있어요!
      </p>
      <Link
        href="/diagnosis"
        className="shrink-0 px-4 py-[7px] bg-[rgba(59,130,246,0.15)] border border-[rgba(59,130,246,0.3)] rounded-[var(--r-xs)] text-[var(--accent)] text-[0.78rem] font-semibold no-underline whitespace-nowrap transition-colors duration-200 hover:bg-[rgba(59,130,246,0.25)]"
      >
        진단 받으러 가기 &rarr;
      </Link>
    </div>
  );
}
