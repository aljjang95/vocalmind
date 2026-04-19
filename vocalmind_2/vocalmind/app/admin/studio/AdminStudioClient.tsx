'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type StuckJob = {
  id: string;
  user_id: string;
  status: string;
  cost_credits: number;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

const MINUTES_OPTIONS = [15, 30, 60, 180, 720];

export default function AdminStudioClient() {
  const [minutes, setMinutes] = useState(30);
  const [items, setItems] = useState<StuckJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [olderThan, setOlderThan] = useState<number>(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/studio/stuck-jobs?minutes=${minutes}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? '조회 실패');
      setItems(data.items as StuckJob[]);
      setOlderThan(data.older_than_minutes ?? minutes);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [minutes]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto max-w-[960px] px-5 py-10">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold text-white">Studio 장애 복구</h1>
          <p className="mt-1 text-xs text-white/50">
            Modal/Runware 콜백 유실로 멈춘 job을 강제 종료 + 크레딧 환불합니다.
            실제 외부 작업이 진행 중일 수 있으니 정말 멈춘 경우에만 사용하세요.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/voices" className="text-xs text-white/50 hover:text-white/80">
            음색 관리
          </Link>
          <span className="text-white/20">·</span>
          <Link href="/studio" className="text-xs text-white/50 hover:text-white/80">
            ← 스튜디오
          </Link>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-white/50">updated_at 기준 미갱신:</span>
        {MINUTES_OPTIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMinutes(m)}
            className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${
              minutes === m
                ? 'bg-amber-500/20 text-amber-200'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {m >= 60 ? `${m / 60}시간+` : `${m}분+`}
          </button>
        ))}
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="ml-2 rounded-md border border-white/15 px-3 py-1.5 text-white/70 hover:border-white/25 disabled:opacity-50"
        >
          {loading ? '조회 중...' : '🔄 새로고침'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-white/40">불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/40">
          ✓ {olderThan}분 이상 멈춘 작업이 없습니다.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <StuckJobRow key={item.id} item={item} onChanged={load} />
          ))}
        </ul>
      )}
    </main>
  );
}

function StuckJobRow({ item, onChanged }: { item: StuckJob; onChanged: () => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const stoppedMinutes = Math.floor(
    (Date.now() - new Date(item.updated_at).getTime()) / 60_000,
  );

  async function forceFail() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setErr('사유를 입력해주세요 (감사 로그에 남습니다)');
      return;
    }
    if (!window.confirm(
      `정말 강제 실패 처리할까요?\n\n${item.cost_credits}크레딧이 유저에게 환불되고\n이후 Modal/Runware 콜백이 와도 무시됩니다.`,
    )) return;

    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/admin/studio/force-fail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: item.id, reason: trimmed }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? '처리 실패');
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '오류');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-amber-400/20 bg-amber-500/[0.04] p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-white/70">
          {item.id.slice(0, 8)}
        </span>
        <span className="rounded-md bg-amber-500/10 px-2 py-1 font-semibold text-amber-200">
          {item.status}
        </span>
        <span className="text-white/50">user: {item.user_id.slice(0, 8)}</span>
        <span className="ml-auto font-semibold text-amber-200">
          ⏱ {stoppedMinutes}분 멈춤
        </span>
      </div>

      <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <dt className="text-white/50">비용</dt>
        <dd className="text-white/80">{item.cost_credits}크레딧</dd>
        <dt className="text-white/50">시도 횟수</dt>
        <dd className="text-white/80">{item.attempt_count}회</dd>
        <dt className="text-white/50">생성</dt>
        <dd className="text-white/80">
          {new Date(item.created_at).toLocaleString('ko-KR')}
        </dd>
        <dt className="text-white/50">마지막 갱신</dt>
        <dd className="text-white/80">
          {new Date(item.updated_at).toLocaleString('ko-KR')}
        </dd>
        {item.last_error && (
          <>
            <dt className="text-white/50">최근 에러</dt>
            <dd className="text-red-300">{item.last_error}</dd>
          </>
        )}
      </dl>

      <div className="flex flex-col gap-2 rounded-lg bg-black/20 p-3">
        <label className="flex flex-col gap-1 text-xs text-white/60">
          강제 실패 사유 (필수 — 감사 로그)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: Modal callback 유실 확인됨"
            className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30"
          />
        </label>
        {err && <div className="text-xs text-red-300">{err}</div>}
        <button
          type="button"
          onClick={forceFail}
          disabled={busy}
          className="w-fit rounded-md border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
        >
          {busy ? '처리 중...' : '⚠ 강제 실패 처리 (환불)'}
        </button>
      </div>
    </li>
  );
}
