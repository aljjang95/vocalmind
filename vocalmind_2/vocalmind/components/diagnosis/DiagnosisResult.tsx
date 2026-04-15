'use client';

import Link from 'next/link';
import { DiagnosisResult as DiagnosisResultType } from '@/types';
import BarChart from './BarChart';

interface DiagnosisResultProps {
  result: DiagnosisResultType;
  onRetry: () => void;
}

export default function DiagnosisResultView({ result, onRetry }: DiagnosisResultProps) {
  return (
    <div className="flex flex-col gap-9 animate-[slideIn_0.6s_ease-out]">
      <div className="flex items-center gap-7 p-7 bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r)] max-md:flex-col max-md:text-center">
        <div className="w-[100px] h-[100px] max-[560px]:w-20 max-[560px]:h-20 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent2)] flex flex-col items-center justify-center shrink-0 shadow-[0_8px_32px_rgba(59,130,246,0.3)]">
          <span className="font-mono text-[2rem] max-[560px]:text-[1.6rem] font-bold text-white leading-none">{result.overallScore}</span>
          <span className="text-[0.62rem] font-semibold text-white/70 uppercase tracking-wider">종합 점수</span>
        </div>
        <div className="flex-1">
          <h2 className="text-2xl max-[560px]:text-xl font-bold mb-2">{result.nickname}님의 보컬 진단 결과</h2>
          <p className="text-[0.9rem] text-[var(--text2)] leading-[1.7]">{result.summary}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="flex items-center gap-2.5 text-base font-bold text-[var(--text)]">항목별 점수</h3>
        <BarChart scores={result.scores} />
      </div>

      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-5">
        <div className="flex flex-col gap-3 p-5 bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r-sm)]">
          <h3 className="flex items-center gap-2.5 text-base font-bold text-[var(--text)]">
            <span className="w-7 h-7 rounded-lg bg-teal-500/[0.12] flex items-center justify-center text-[0.82rem] font-bold shrink-0">&#10003;</span>
            강점
          </h3>
          <ul className="list-none flex flex-col gap-2">
            {result.strengths.map((s, i) => (
              <li key={i} className="text-[0.88rem] text-[var(--text2)] pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[9px] before:w-[5px] before:h-[5px] before:rounded-full before:bg-[var(--muted)]">{s}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3 p-5 bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r-sm)]">
          <h3 className="flex items-center gap-2.5 text-base font-bold text-[var(--text)]">
            <span className="w-7 h-7 rounded-lg bg-rose-500/[0.12] flex items-center justify-center text-[0.82rem] font-bold shrink-0">!</span>
            개선점
          </h3>
          <ul className="list-none flex flex-col gap-2">
            {result.weaknesses.map((w, i) => (
              <li key={i} className="text-[0.88rem] text-[var(--text2)] pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[9px] before:w-[5px] before:h-[5px] before:rounded-full before:bg-[var(--muted)]">{w}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="flex items-center gap-2.5 text-base font-bold text-[var(--text)]">맞춤 추천</h3>
        <div className="flex flex-col gap-2.5">
          {result.recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-3.5 px-[18px] py-4 bg-[var(--bg3)] border border-[var(--border2)] rounded-[var(--r-sm)] text-[0.88rem] text-[var(--text2)] leading-relaxed">
              <span className="w-[26px] h-[26px] rounded-full bg-blue-500/[0.14] text-[var(--accent-lt)] font-mono text-[0.78rem] font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3.5 justify-center pt-2 max-md:flex-col max-md:[&>*]:w-full max-md:[&>*]:text-center max-md:[&>*]:justify-center">
        <Link href="/coach" className="btn-primary">
          맞춤 코칭 시작하기 &rarr;
        </Link>
        <button type="button" className="btn-outline" onClick={onRetry}>
          다시 진단하기
        </button>
      </div>
    </div>
  );
}
