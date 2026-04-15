'use client';

import { useWarmupStore } from '@/stores/warmupStore';
import { GlowCard } from '@/components/ui/glow-card';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${mins}`;
  } catch {
    return iso;
  }
}

function getWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default function RoutineHistory() {
  const records = useWarmupStore((s) => s.records);

  const completedRecords = records
    .filter((r) => r.completedAt)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 10);

  const weekStart = getWeekStart();
  const thisWeekCount = completedRecords.filter((r) => {
    try {
      return new Date(r.completedAt) >= weekStart;
    } catch {
      return false;
    }
  }).length;

  return (
    <GlowCard className="max-w-[680px] mx-auto p-6">
      <h3 className="text-lg font-bold text-[var(--text)] mb-4">워밍업 기록</h3>

      <div className="flex items-center gap-2 px-4 py-2.5 bg-green-500/[0.08] border border-green-500/20 rounded-md mb-4 text-sm text-[var(--success-lt)]">
        이번 주 워밍업 <span className="font-bold font-mono">{thisWeekCount}회</span> 완료
      </div>

      {completedRecords.length === 0 ? (
        <div className="text-center py-6 text-[var(--muted)] text-sm">
          아직 완료한 워밍업이 없습니다.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {completedRecords.map((record, idx) => (
            <div key={`${record.routineId}-${idx}`} className="flex items-center justify-between px-4 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-md">
              <span className="text-sm text-[var(--text)]">
                {formatDate(record.completedAt)}
              </span>
              <span className="text-xs text-[var(--text2)] font-mono">
                {record.stagesCompleted.length}단계 완료
              </span>
            </div>
          ))}
        </div>
      )}
    </GlowCard>
  );
}
