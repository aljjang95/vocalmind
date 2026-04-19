'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type SourceClip = {
  sentence_index: number;
  storage_path: string;
  duration_sec: number;
};

type VoiceIdentity = {
  id: string;
  user_id: string;
  status: 'training' | 'ready' | 'failed' | 'collecting';
  source_clip_count: number;
  total_duration_sec: number;
  source_clips: SourceClip[];
  rvc_model_path: string | null;
  rvc_index_path: string | null;
  last_error: string | null;
  created_at: string;
  ready_at: string | null;
};

type StatusFilter = 'training' | 'ready' | 'failed';

export default function AdminVoicesClient() {
  const [items, setItems] = useState<VoiceIdentity[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('training');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/voices?status=${filter}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? '목록 조회 실패');
      setItems(data.items as VoiceIdentity[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto max-w-[960px] px-5 py-10">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-[24px] font-extrabold text-white">음색 승인 관리</h1>
          <p className="mt-1 text-xs text-white/50">
            유저가 등록한 10문장 녹음을 듣고 RVC 학습 → 모델 업로드 → 승인 처리.
          </p>
        </div>
        <Link href="/studio" className="text-xs text-white/50 hover:text-white/80">
          ← 스튜디오
        </Link>
      </header>

      <div className="mb-5 flex gap-2">
        {(['training', 'failed', 'ready'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {f === 'training' ? '학습 대기' : f === 'failed' ? '실패' : '승인 완료'}
          </button>
        ))}
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
          해당 상태의 항목이 없습니다.
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <VoiceRow key={item.id} item={item} onChanged={load} />
          ))}
        </ul>
      )}
    </main>
  );
}

function VoiceRow({ item, onChanged }: { item: VoiceIdentity; onChanged: () => void }) {
  const [showClips, setShowClips] = useState(false);
  const [modelPath, setModelPath] = useState(item.rvc_model_path ?? '');
  const [indexPath, setIndexPath] = useState(item.rvc_index_path ?? '');
  const [mos, setMos] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preloadedUrls, setPreloadedUrls] = useState<Record<number, string>>({});
  const [preloadBusy, setPreloadBusy] = useState(false);

  async function preloadAllClips() {
    if (preloadBusy) return;
    setPreloadBusy(true);
    try {
      const entries = await Promise.all(
        item.source_clips.map(async (c) => {
          const r = await fetch(
            `/api/admin/voices/clip-url?path=${encodeURIComponent(c.storage_path)}`,
          );
          const data = await r.json();
          return [c.sentence_index, data.url as string] as const;
        }),
      );
      const map: Record<number, string> = {};
      for (const [k, v] of entries) map[k] = v;
      setPreloadedUrls(map);
      setShowClips(true);
    } finally {
      setPreloadBusy(false);
    }
  }

  async function approve() {
    if (!modelPath.trim()) {
      setError('rvc_model_path가 필요합니다');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/voices/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceIdentityId: item.id,
          rvcModelPath: modelPath.trim(),
          rvcIndexPath: indexPath.trim() || null,
          mosScore: mos ? Number(mos) : null,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? '승인 실패');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류');
    } finally {
      setSubmitting(false);
    }
  }

  async function markFailed() {
    const reason = prompt('실패 사유?');
    if (!reason) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/admin/voices/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceIdentityId: item.id,
          markFailed: true,
          reason,
        }),
      });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.error ?? '처리 실패');
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-white/70">{item.id.slice(0, 8)}</span>
        <span className="rounded-md bg-white/5 px-2 py-1 text-white/50">user: {item.user_id.slice(0, 8)}</span>
        <span className="text-white/40">· {new Date(item.created_at).toLocaleString('ko-KR')}</span>
        <span className="ml-auto text-white/60">
          클립 {item.source_clip_count}개 · 총 {Math.round(item.total_duration_sec)}초
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-3 text-xs">
        <button
          type="button"
          onClick={() => setShowClips((v) => !v)}
          className="text-emerald-300 hover:underline"
        >
          {showClips ? '▼' : '▶'} 녹음 클립 듣기 ({item.source_clips.length}개)
        </button>
        <button
          type="button"
          onClick={preloadAllClips}
          disabled={preloadBusy}
          className="rounded-md border border-emerald-400/30 px-2 py-0.5 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
        >
          {preloadBusy ? '로드 중...' : '🎧 모두 미리 재생'}
        </button>
      </div>

      {showClips && (
        <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
          {item.source_clips.map((c) => (
            <ClipRow
              key={c.sentence_index}
              clip={c}
              preloadedUrl={preloadedUrls[c.sentence_index] ?? null}
            />
          ))}
        </div>
      )}

      {item.status === 'training' && (
        <div className="space-y-3 rounded-lg bg-black/20 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-white/60">
              RVC model path (bucket/path.pth)
              <input
                value={modelPath}
                onChange={(e) => setModelPath(e.target.value)}
                placeholder="ai-cover-models/<user>/<id>/model.pth"
                className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-white/60">
              RVC index path (선택)
              <input
                value={indexPath}
                onChange={(e) => setIndexPath(e.target.value)}
                placeholder="ai-cover-models/<user>/<id>/model.index"
                className="rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-white/60">
            MOS 점수 (0~5, 선택)
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={mos}
              onChange={(e) => setMos(e.target.value)}
              placeholder="3.5"
              className="w-32 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30"
            />
          </label>
          {error && <div className="text-xs text-red-300">{error}</div>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={approve}
              className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              {submitting ? '처리 중...' : '✓ 승인 (ready)'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={markFailed}
              className="rounded-md border border-red-400/30 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-50"
            >
              ✗ 실패 처리
            </button>
          </div>
        </div>
      )}

      {item.status === 'ready' && (
        <div className="text-xs text-emerald-300">
          ✓ 승인 완료 {item.ready_at && `· ${new Date(item.ready_at).toLocaleString('ko-KR')}`}
          <div className="mt-1 font-mono text-white/50">{item.rvc_model_path}</div>
        </div>
      )}

      {item.status === 'failed' && item.last_error && (
        <div className="text-xs text-red-300">✗ {item.last_error}</div>
      )}
    </li>
  );
}

function ClipRow({ clip, preloadedUrl }: { clip: SourceClip; preloadedUrl: string | null }) {
  const [url, setUrl] = useState<string | null>(preloadedUrl);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (preloadedUrl) setUrl(preloadedUrl);
  }, [preloadedUrl]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/admin/voices/clip-url?path=${encodeURIComponent(clip.storage_path)}`,
      );
      const data = await r.json();
      setUrl(data.url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-md bg-white/[0.02] px-3 py-2 text-xs">
      <span className="w-8 text-white/40">#{clip.sentence_index + 1}</span>
      {url ? (
        <audio controls src={url} className="h-8 flex-1" preload="metadata" />
      ) : (
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex-1 text-left text-emerald-300 hover:underline disabled:opacity-50"
        >
          {loading ? '로딩...' : '▶ 재생'}
        </button>
      )}
      <span className="text-white/40">{clip.duration_sec}s</span>
    </div>
  );
}
