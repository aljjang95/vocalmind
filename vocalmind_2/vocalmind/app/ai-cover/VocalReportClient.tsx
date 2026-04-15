'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';

type Phase = 'idle' | 'recording' | 'analyzing' | 'result';

interface TensionScore {
  overall: number;
  laryngeal: number;
  tongue_root: number;
  jaw: number;
  register_break: number;
  detail: string;
}

interface AnalysisResult {
  tension: TensionScore;
  consultation: {
    problems: string[];
    roadmap: string[];
    suggested_stage_id: number;
    summary: string;
  };
}

const AXIS_LABELS: Record<string, string> = {
  laryngeal: '후두 긴장',
  tongue_root: '혀뿌리 긴장',
  jaw: '턱 긴장',
  register_break: '성구전환',
};

function TensionBar({ label, value }: { label: string; value: number }) {
  const color = value < 30 ? '#34d399' : value < 60 ? '#fbbf24' : '#f87171';
  const statusText = value < 30 ? '양호' : value < 60 ? '주의' : '긴장';

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-white/75">{label}</span>
        <span className="text-[1.125rem] font-bold" style={{ color }}>{value}<span className="text-xs opacity-50 ml-0.5">/ 100</span></span>
      </div>
      <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-[600ms]" style={{ width: `${value}%`, background: color }} />
      </div>
      <div className="text-xs font-semibold" style={{ color }}>{statusText}</div>
    </div>
  );
}

export default function VocalReportClient() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(200);
      mediaRef.current = mr;
      setPhase('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((n) => n + 1), 1000);
    } catch {
      setError('마이크 권한이 필요합니다');
    }
  }, []);

  const stopAndAnalyze = useCallback(async () => {
    if (!mediaRef.current) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    const mr = mediaRef.current;
    mr.stop();
    setPhase('analyzing');

    await new Promise<void>((resolve) => {
      mr.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        resolve();
      };
    });

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const fd = new FormData();
    fd.append('audio', blob, 'recording.webm');

    try {
      const res = await fetch('/api/onboarding-analyze', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('분석 실패');
      const data: AnalysisResult = await res.json();
      setResult(data);
      setPhase('result');
    } catch {
      setError('분석 중 오류가 발생했습니다. 다시 시도해주세요.');
      setPhase('idle');
    }
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setResult(null);
    setError('');
    setElapsed(0);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-white flex items-start justify-center p-12 max-sm:p-6">
      <div className="w-full max-w-[560px] flex flex-col gap-8">

        {/* 상단 네비 */}
        <div className="flex items-center justify-between mb-2">
          <Link href="/" className="text-[13px] text-[var(--text-muted)] no-underline">&larr; HLB 보컬스튜디오</Link>
          <Link href="/journey" className="text-[13px] text-[var(--text-muted)] no-underline">소리의 길</Link>
        </div>

        {/* 헤더 */}
        <div className="text-center">
          <div className="inline-block px-3.5 py-1 rounded-full text-xs font-semibold tracking-[0.08em] text-indigo-400 bg-indigo-500/[0.12] border border-indigo-500/25 mb-4">발성 분석</div>
          <h1 className="text-[2rem] font-extrabold mb-2">지금 내 목소리 상태</h1>
          <p className="text-[0.9375rem] text-white/50 leading-relaxed">
            노래 한 소절을 부르면 AI가 4축 긴장도를 측정합니다
          </p>
        </div>

        {/* idle */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div
              className="w-24 h-24 rounded-full bg-indigo-500/15 border-2 border-indigo-500/40 flex items-center justify-center text-indigo-400 cursor-pointer hover:bg-indigo-500/25 hover:scale-105 transition-all"
              onClick={startRecording}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </div>
            <p className="text-[0.9375rem] font-medium text-white/70">버튼을 눌러 녹음 시작</p>
            <p className="text-[0.8125rem] text-white/[0.35]">편하게 아무 노래나 5~10초 불러주세요</p>
            {error && <p className="text-sm text-red-400 px-4 py-2.5 bg-red-500/10 border border-red-500/25 rounded-lg">{error}</p>}
          </div>
        )}

        {/* recording */}
        {phase === 'recording' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div
              className="w-24 h-24 rounded-full bg-red-500/15 border-2 border-red-500/50 flex items-center justify-center cursor-pointer animate-pulse"
              onClick={stopAndAnalyze}
            >
              <div className="w-7 h-7 rounded-full bg-red-500" />
            </div>
            <p className="text-xl font-bold text-red-400">{elapsed}초 녹음 중</p>
            <p className="text-[0.9375rem] font-medium text-white/70">버튼을 눌러 분석 시작</p>
            <p className="text-[0.8125rem] text-white/[0.35]">최소 5초 이상 녹음하면 더 정확합니다</p>
          </div>
        )}

        {/* analyzing */}
        {phase === 'analyzing' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="w-12 h-12 border-[3px] border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
            <p className="text-base font-semibold text-white/80">AI가 분석하는 중...</p>
            <p className="text-[0.8125rem] text-white/[0.35]">후두·혀뿌리·턱 긴장을 측정합니다</p>
          </div>
        )}

        {/* result */}
        {phase === 'result' && result && (
          <div className="flex flex-col gap-5">
            {/* 종합 점수 */}
            <div className="text-center p-8 bg-white/[0.03] border border-white/[0.08] rounded-2xl">
              <div className="text-xs tracking-[0.1em] text-white/40 uppercase mb-2">종합 긴장 점수</div>
              <div className="text-[4rem] font-extrabold leading-none mb-2" style={{
                color: result.tension.overall < 30 ? '#34d399' : result.tension.overall < 60 ? '#fbbf24' : '#f87171',
              }}>
                {result.tension.overall}
                <span className="text-xl opacity-50">/ 100</span>
              </div>
              <div className="text-[0.9375rem] text-white/60">
                {result.tension.overall < 30 ? '긴장이 거의 없습니다' :
                  result.tension.overall < 60 ? '부분적인 긴장이 감지됩니다' :
                    '전반적인 긴장 완화가 필요합니다'}
              </div>
            </div>

            {/* 4축 바 */}
            <div className="p-6 bg-white/[0.03] border border-white/[0.08] rounded-2xl flex flex-col gap-5">
              <h3 className="text-[0.8125rem] font-semibold tracking-[0.08em] text-white/40 uppercase">4축 분석</h3>
              {(Object.entries(AXIS_LABELS) as [keyof typeof AXIS_LABELS, string][]).map(([key, label]) => (
                <TensionBar
                  key={key}
                  label={label}
                  value={result.tension[key as keyof TensionScore] as number}
                />
              ))}
            </div>

            {/* AI 코멘트 */}
            {result.tension.detail && (
              <div className="px-6 py-5 bg-indigo-500/[0.06] border border-indigo-500/20 rounded-xl">
                <div className="text-xs font-semibold tracking-[0.08em] text-indigo-300/70 uppercase mb-2">AI 분석 코멘트</div>
                <p className="text-[0.9375rem] leading-[1.7] text-white/75">{result.tension.detail}</p>
              </div>
            )}

            {/* 문제점 */}
            {result.consultation.problems.length > 0 && (
              <div className="px-6 py-5 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                <div className="text-xs font-semibold tracking-[0.08em] text-white/40 uppercase mb-3">발견된 패턴</div>
                <ul className="flex flex-col gap-2 list-none p-0 m-0">
                  {result.consultation.problems.map((p, i) => (
                    <li key={i} className="text-sm text-white/70 pl-4 relative leading-relaxed before:content-['·'] before:absolute before:left-0 before:text-indigo-400">{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 추천 단계 */}
            <div className="flex items-center justify-between px-6 py-4 bg-indigo-500/[0.08] border border-indigo-500/25 rounded-xl">
              <span className="text-sm text-white/60">추천 시작 단계</span>
              <span className="text-base font-bold text-indigo-400">단계 {result.consultation.suggested_stage_id}</span>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 py-3.5 rounded-xl border border-white/[0.12] bg-transparent text-white/70 text-[0.9375rem] font-medium cursor-pointer hover:bg-white/5 hover:text-white transition-all" onClick={reset}>다시 분석하기</button>
              <Link href={`/journey/${result.consultation.suggested_stage_id}`} className="flex-[2] py-3.5 rounded-xl border-none bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-[0.9375rem] font-semibold no-underline flex items-center justify-center hover:opacity-90 transition-opacity">
                지금 연습 시작
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
