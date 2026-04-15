'use client';

import { useMemo } from 'react';
import { useBreathingStore } from '@/stores/breathingStore';

interface DayData {
  date: string;
  label: string;
  maxExhale: number;
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()} ${days[d.getDay()]}`;
}

function getLast28Days(): string[] {
  const result: string[] = [];
  const now = new Date();
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

export default function WeeklyChart() {
  const records = useBreathingStore((s) => s.records);

  const { chartData, uniqueDays, changeRate, changeDirection } = useMemo(() => {
    const last28 = getLast28Days();

    const byDate: Record<string, number> = {};
    for (const r of records) {
      if (last28.includes(r.date)) {
        byDate[r.date] = Math.max(byDate[r.date] ?? 0, r.longestExhaleSec);
      }
    }

    const data: DayData[] = last28.map((date) => ({
      date,
      label: getDayLabel(date),
      maxExhale: byDate[date] ?? 0,
    }));

    const daysWithData = data.filter((d) => d.maxExhale > 0);

    const last7 = data.slice(21);
    const prev7 = data.slice(14, 21);
    const avg = (arr: DayData[]) => {
      const vals = arr.filter((d) => d.maxExhale > 0).map((d) => d.maxExhale);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };
    const avgLast = avg(last7);
    const avgPrev = avg(prev7);
    let rate = 0;
    let direction: 'up' | 'down' | 'neutral' = 'neutral';
    if (avgPrev > 0 && avgLast > 0) {
      rate = Math.round(((avgLast - avgPrev) / avgPrev) * 100);
      direction = rate > 0 ? 'up' : rate < 0 ? 'down' : 'neutral';
    }

    return {
      chartData: data,
      uniqueDays: daysWithData.length,
      changeRate: Math.abs(rate),
      changeDirection: direction,
    };
  }, [records]);

  if (uniqueDays < 3) {
    return (
      <div className="flex flex-col gap-4 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl max-md:p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--text)]">주간 기록</h3>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-5 text-center">
          <div className="text-2xl text-[var(--muted)]">---</div>
          <p className="text-sm text-[var(--text2)] leading-relaxed">
            3일 이상 연습하면 그래프가 표시됩니다.
            <br />
            꾸준히 연습하여 호흡 변화를 확인해보세요.
          </p>
        </div>
      </div>
    );
  }

  // SVG chart dimensions
  const SVG_W = 700;
  const SVG_H = 200;
  const PAD_LEFT = 40;
  const PAD_RIGHT = 10;
  const PAD_TOP = 10;
  const PAD_BOTTOM = 50;
  const chartW = SVG_W - PAD_LEFT - PAD_RIGHT;
  const chartH = SVG_H - PAD_TOP - PAD_BOTTOM;

  const visibleData = chartData.slice(14);
  const maxVal = Math.max(...visibleData.map((d) => d.maxExhale), 5);
  const barCount = visibleData.length;
  const barGap = 4;
  const barWidth = Math.max((chartW - barGap * (barCount - 1)) / barCount, 6);

  const changeClass =
    changeDirection === 'up'
      ? 'bg-green-500/[0.12] text-[var(--success)]'
      : changeDirection === 'down'
        ? 'bg-red-500/[0.12] text-[var(--error)]'
        : 'bg-[var(--surface2)] text-[var(--text2)]';

  const changeLabel =
    changeDirection === 'up'
      ? `+${changeRate}%`
      : changeDirection === 'down'
        ? `-${changeRate}%`
        : '-- %';

  return (
    <div className="flex flex-col gap-4 p-6 bg-[var(--surface)] border border-[var(--border)] rounded-xl max-md:p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-[var(--text)]">주간 기록</h3>
        <span className={`text-sm font-semibold px-2.5 py-1 rounded ${changeClass}`}>
          이전 주 대비 {changeLabel}
        </span>
      </div>
      <div className="w-full overflow-x-auto">
        <svg
          className="block"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          width="100%"
          role="img"
          aria-label="최근 2주 호흡 기록 차트"
        >
          {/* Y-axis gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const y = PAD_TOP + chartH * (1 - pct);
            const val = Math.round(maxVal * pct);
            return (
              <g key={pct}>
                <line
                  x1={PAD_LEFT}
                  y1={y}
                  x2={PAD_LEFT + chartW}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
                <text
                  x={PAD_LEFT - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--text-muted)"
                  fontSize={10}
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {visibleData.map((d, i) => {
            const x = PAD_LEFT + i * (barWidth + barGap);
            const barH = d.maxExhale > 0 ? (d.maxExhale / maxVal) * chartH : 0;
            const y = PAD_TOP + chartH - barH;
            const showLabel = i % 2 === 0 || barCount <= 14;

            return (
              <g key={d.date}>
                {d.maxExhale > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    rx={3}
                    fill="url(#barGrad)"
                    opacity={0.85}
                  />
                )}
                {d.maxExhale === 0 && (
                  <rect
                    x={x}
                    y={PAD_TOP + chartH - 2}
                    width={barWidth}
                    height={2}
                    rx={1}
                    fill="rgba(255,255,255,0.08)"
                  />
                )}
                {showLabel && (
                  <text
                    x={x + barWidth / 2}
                    y={SVG_H - 8}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize={9}
                    transform={`rotate(-30 ${x + barWidth / 2} ${SVG_H - 8})`}
                  >
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Gradient definition */}
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#22C55E" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
