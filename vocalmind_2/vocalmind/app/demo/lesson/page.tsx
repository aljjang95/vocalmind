'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

const PHASES = ['왜?', '시범', '실습', '평가', '요약'];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function LessonDemo() {
  const [recording, setRecording] = useState(true);
  const [tick, setTick] = useState(0);

  const metrics = useMemo(() => {
    const wave = Math.sin(tick / 2);
    return [
      { label: '후두', value: clamp(24 + wave * 4) },
      { label: '혀뿌리', value: clamp(32 + wave * 6) },
      { label: '턱', value: clamp(21 + wave * 5) },
      { label: '성구전환', value: clamp(28 + wave * 4) },
    ];
  }, [tick]);

  const toggle = () => {
    setRecording((next) => !next);
    setTick((next) => next + 1);
  };

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 md:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              HLB 보컬스튜디오
            </Link>
            <h1 className="mt-3 text-3xl font-bold">실시간 수업 데모</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              선생님 시범과 내 목소리를 비교하며 후두, 혀뿌리, 턱, 성구전환 긴장을 확인하는 흐름입니다.
            </p>
          </div>
          <Link
            href="/journey/1"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--accent)] px-5 text-sm font-semibold text-white"
          >
            실제 레슨 열기
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-5">
          {PHASES.map((phase, index) => (
            <div
              key={phase}
              className={`rounded-lg border px-4 py-3 text-sm ${
                index === 2
                  ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text-primary)]'
                  : 'border-white/10 bg-white/[0.03] text-[var(--text-secondary)]'
              }`}
            >
              <div className="text-xs text-[var(--text-muted)]">{index + 1}</div>
              <div className="mt-1 font-semibold">{phase}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">음정 비교</h2>
              <div className="flex gap-3 text-xs text-[var(--text-secondary)]">
                <span>선생님</span>
                <span>내 목소리</span>
              </div>
            </div>
            <div className="relative h-64 overflow-hidden rounded-lg bg-black/20">
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/10" />
              <div className="absolute left-0 right-0 top-[38%] h-1 rounded-full bg-emerald-400/70" />
              <div
                className={`absolute left-0 right-0 h-1 rounded-full bg-sky-300/80 transition-all ${
                  recording ? 'top-[42%]' : 'top-[48%]'
                }`}
              />
              <div className="absolute bottom-5 left-5 rounded bg-black/30 px-3 py-2 text-sm text-[var(--text-secondary)]">
                {recording ? '실시간 피치 비교 중' : '일시 정지됨'}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-white/[0.04] p-4">
                <div className="text-xs text-[var(--text-muted)]">음정 정확도</div>
                <div className="mt-1 text-2xl font-bold">74%</div>
              </div>
              <div className="rounded-lg bg-white/[0.04] p-4">
                <div className="text-xs text-[var(--text-muted)]">음정 안정도</div>
                <div className="mt-1 text-2xl font-bold">81%</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5 text-center">
              <button
                type="button"
                onClick={toggle}
                className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full text-3xl text-white ${
                  recording ? 'bg-red-600' : 'bg-[var(--accent)]'
                }`}
                aria-label={recording ? '녹음 정지' : '녹음 시작'}
              >
                {recording ? '■' : '▶'}
              </button>
              <p className="mt-4 text-sm text-[var(--text-secondary)]">
                {recording ? '녹음 중입니다' : '버튼을 눌러 다시 시작하세요'}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <h2 className="mb-4 text-lg font-semibold">실시간 긴장도</h2>
              <div className="space-y-3">
                {metrics.map((metric) => (
                  <div key={metric.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{metric.label}</span>
                      <span>{metric.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-emerald-400" style={{ width: `${metric.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm leading-6 text-emerald-100">
          턱에 힘이 조금 들어가고 있어요. 입을 자연스럽게 벌리고 아래턱을 부드럽게 내려보세요.
        </section>
      </div>
    </main>
  );
}
