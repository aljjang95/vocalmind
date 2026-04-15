'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { usePracticeStore } from '@/stores/practiceStore';
import type { VocalTechnique } from '@/types';

// ── Technique definitions ──

type TechniqueKey = VocalTechnique['type'];

interface TechniqueInfo {
  key: TechniqueKey;
  color: string;
  label: string;
  description: string;
}

const TECHNIQUES: TechniqueInfo[] = [
  { key: 'vibrato',  color: '#9B59B6', label: '바이브레이션', description: '바이브레이션 - 음을 규칙적으로 떨어뜨리는 기법' },
  { key: 'bending',  color: '#3498DB', label: '벤딩',        description: '벤딩 - 음을 부드럽게 구부리는 기법' },
  { key: 'belting',  color: '#E74C3C', label: '벨팅',        description: '벨팅 - 흉성으로 강하게 고음을 내는 기법' },
  { key: 'falsetto', color: '#E91E63', label: '팔세토',      description: '팔세토 - 가성으로 높은 음을 내는 기법' },
  { key: 'whisper',  color: '#95A5A6', label: '브레시(위스퍼)', description: '브레시 - 숨 섞인 부드러운 톤' },
  { key: 'breathy',  color: '#95A5A6', label: '브레시',      description: '브레시 - 숨 섞인 부드러운 톤' },
  { key: 'run',      color: '#F39C12', label: '런/리프',     description: '런/리프 - 빠르게 음을 오르내리는 기법' },
  { key: 'crack',    color: '#F1C40F', label: '꺾기',        description: '꺾기 - 음을 의도적으로 꺾는 한국식 창법' },
  { key: 'mix',      color: '#2ECC71', label: '믹스보이스',   description: '믹스보이스 - 흉성과 두성을 섞은 발성' },
];

// Map for quick lookup
const TECHNIQUE_MAP = new Map(TECHNIQUES.map((t) => [t.key, t]));

// Unique display rows (whisper and breathy share a row)
const DISPLAY_ROWS: TechniqueKey[] = [
  'vibrato', 'bending', 'belting', 'falsetto', 'whisper', 'run', 'crack', 'mix',
];

function getRowIndex(type: TechniqueKey): number {
  if (type === 'breathy') return DISPLAY_ROWS.indexOf('whisper');
  return DISPLAY_ROWS.indexOf(type);
}

function getTechniqueInfo(type: TechniqueKey): TechniqueInfo {
  return TECHNIQUE_MAP.get(type) ?? TECHNIQUES[0];
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Component ──

interface Props {
  onSeek: (time: number) => void;
}

export default function VocalMap({ onSeek }: Props) {
  const {
    currentAnalysis,
    duration,
    currentTime,
    setMode,
    setLoop,
    setActivePanel,
  } = usePracticeStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  // UI state
  const [showFilter, setShowFilter] = useState(false);
  const [enabledTypes, setEnabledTypes] = useState<Set<TechniqueKey>>(
    () => new Set(DISPLAY_ROWS.concat('breathy')),
  );
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; technique: VocalTechnique;
  } | null>(null);
  const [selectedTechnique, setSelectedTechnique] = useState<VocalTechnique | null>(null);

  const vocalMap = currentAnalysis?.vocalMap ?? [];
  const totalDuration = duration > 0 ? duration : (vocalMap.length > 0
    ? Math.max(...vocalMap.map((v) => v.endTime)) + 1
    : 1);

  // Filtered techniques
  const filteredMap = useMemo(
    () => vocalMap.filter((v) => enabledTypes.has(v.type)),
    [vocalMap, enabledTypes],
  );

  // Summary stats
  const techniqueStats = useMemo(() => {
    const counts = new Map<TechniqueKey, number>();
    for (const v of vocalMap) {
      counts.set(v.type, (counts.get(v.type) ?? 0) + 1);
    }
    const entries = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]);
    return entries;
  }, [vocalMap]);

  const maxCount = useMemo(
    () => (techniqueStats.length > 0 ? techniqueStats[0][1] : 0),
    [techniqueStats],
  );

  const topTechnique = useMemo(
    () => (techniqueStats.length > 0 ? getTechniqueInfo(techniqueStats[0][0]) : null),
    [techniqueStats],
  );

  const uniqueTypeCount = techniqueStats.length;

  const difficulty = useMemo(() => {
    if (uniqueTypeCount >= 7) return { label: '고급', cls: "bg-red-500/[0.12] text-[var(--error-lt)] border border-red-500/25" };
    if (uniqueTypeCount >= 4) return { label: '중급', cls: "bg-yellow-500/[0.12] text-[var(--warning)] border border-yellow-500/25" };
    return { label: '기본', cls: "bg-green-500/[0.12] text-[var(--success-lt)] border border-green-500/25" };
  }, [uniqueTypeCount]);

  // ── Filter toggle ──

  const toggleType = useCallback((type: TechniqueKey) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
        // Also toggle paired breathy/whisper
        if (type === 'whisper') next.delete('breathy');
        if (type === 'breathy') next.delete('whisper');
      } else {
        next.add(type);
        if (type === 'whisper') next.add('breathy');
        if (type === 'breathy') next.add('whisper');
      }
      return next;
    });
  }, []);

  // ── Canvas hit-test helper ──

  const hitTest = useCallback((clientX: number, clientY: number): VocalTechnique | null => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const rowCount = DISPLAY_ROWS.length;
    const labelWidth = 70;
    const chartLeft = labelWidth;
    const chartWidth = w - labelWidth - 10;
    const rowHeight = h / rowCount;
    const barPadY = 4;

    for (const v of filteredMap) {
      const row = getRowIndex(v.type);
      if (row < 0) continue;
      const info = getTechniqueInfo(v.type);
      if (!info) continue;

      const bx = chartLeft + (v.startTime / totalDuration) * chartWidth;
      const bw = Math.max(4, ((v.endTime - v.startTime) / totalDuration) * chartWidth);
      const by = row * rowHeight + barPadY;
      const bh = rowHeight - barPadY * 2;

      if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
        return v;
      }
    }
    return null;
  }, [filteredMap, totalDuration]);

  // ── Mouse events ──

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        technique: hit,
      });
    } else {
      setTooltip(null);
    }
  }, [hitTest]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      setSelectedTechnique(hit);
      setTooltip(null);
    }
  }, [hitTest]);

  // ── Popup actions ──

  const handleListen = useCallback(() => {
    if (!selectedTechnique) return;
    onSeek(selectedTechnique.startTime);
    setSelectedTechnique(null);
  }, [selectedTechnique, onSeek]);

  const handlePractice = useCallback(() => {
    if (!selectedTechnique) return;
    setMode('practice');
    setLoop(selectedTechnique.startTime, selectedTechnique.endTime);
    setActivePanel('pitch');
    setSelectedTechnique(null);
  }, [selectedTechnique, setMode, setLoop, setActivePanel]);

  // ── Canvas rendering ──

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      if (!canvas || !ctx || !container) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const rowCount = DISPLAY_ROWS.length;
      const labelWidth = 70;
      const chartLeft = labelWidth;
      const chartWidth = w - labelWidth - 10;
      const rowHeight = h / rowCount;
      const barPadY = 4;

      // ── Draw row backgrounds and labels ──
      for (let i = 0; i < rowCount; i++) {
        const y = i * rowHeight;
        const rowType = DISPLAY_ROWS[i];
        const info = getTechniqueInfo(rowType);

        // Alternating row bg
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.015)';
          ctx.fillRect(0, y, w, rowHeight);
        }

        // Row divider
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(labelWidth, y + rowHeight);
        ctx.lineTo(w, y + rowHeight);
        ctx.stroke();

        // Label
        ctx.fillStyle = enabledTypes.has(rowType) ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)';
        ctx.font = '11px Inter, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'right';
        ctx.fillText(info.label, labelWidth - 8, y + rowHeight / 2);
      }

      // ── Draw time markers ──
      const timeStep = totalDuration > 120 ? 30 : totalDuration > 60 ? 15 : totalDuration > 30 ? 10 : 5;
      for (let t = 0; t <= totalDuration; t += timeStep) {
        const x = chartLeft + (t / totalDuration) * chartWidth;
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '9px Inter, sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'center';
        ctx.fillText(formatTime(t), x, h - 2);
      }

      // ── Draw technique bars ──
      for (const v of filteredMap) {
        const row = getRowIndex(v.type);
        if (row < 0) continue;
        const info = getTechniqueInfo(v.type);

        const bx = chartLeft + (v.startTime / totalDuration) * chartWidth;
        const bw = Math.max(4, ((v.endTime - v.startTime) / totalDuration) * chartWidth);
        const by = row * rowHeight + barPadY;
        const bh = rowHeight - barPadY * 2;

        // Bar fill with intensity-based alpha
        const alpha = 0.4 + v.intensity * 0.5;
        ctx.fillStyle = info.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 3);
        ctx.fill();

        // Border
        ctx.strokeStyle = info.color + '88';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 3);
        ctx.stroke();
      }

      // ── Draw current time indicator ──
      if (currentTime > 0 && currentTime <= totalDuration) {
        const cx = chartLeft + (currentTime / totalDuration) * chartWidth;
        ctx.strokeStyle = 'rgba(250, 250, 250, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [filteredMap, totalDuration, currentTime, enabledTypes]);

  // Cleanup
  useEffect(() => {
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // ── Empty state ──
  if (!currentAnalysis || vocalMap.length === 0) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <div className="text-2xl opacity-[0.15]">&#9835;</div>
          <div className="text-sm text-[var(--muted)] leading-relaxed max-w-[300px]">
            보컬맵 분석이 필요합니다. 곡을 분석해주세요.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
        <span className="text-sm font-bold text-[var(--text)]">보컬맵 - 테크닉 시각화</span>
        <div className="flex items-center gap-2">
          <button
            className={`${"flex items-center gap-1 px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-xs font-medium cursor-pointer transition-all hover:bg-[var(--surface2)] hover:text-[var(--text)]"} ${showFilter ? "bg-[var(--surface2)] text-[var(--accent-lt)] border-blue-500/25" : ''}`}
            onClick={() => setShowFilter((v) => !v)}
          >
            필터
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div className="flex flex-wrap gap-1.5 px-5 py-2.5 bg-[var(--surface)] border-b border-[var(--border)]">
          {DISPLAY_ROWS.map((type) => {
            const info = getTechniqueInfo(type);
            const checked = enabledTypes.has(type);
            return (
              <label
                key={type}
                className={`${"flex items-center gap-[5px] px-2.5 py-[3px] rounded-md cursor-pointer transition-colors select-none hover:bg-[var(--surface2)]"} ${!checked ? "[&_.filter-label]:text-[var(--muted)] [&_.filter-label]:line-through" : ''}`}
              >
                <input
                  type="checkbox"
                  className="appearance-none w-3.5 h-3.5 border-[1.5px] border-[var(--border2)] rounded-[3px] cursor-pointer relative shrink-0 checked:border-transparent checked:after:content-[''] checked:after:absolute checked:after:top-0.5 checked:after:left-1 checked:after:w-1 checked:after:h-[7px] checked:after:border-white checked:after:border-solid checked:after:border-[0_2px_2px_0] checked:after:rotate-45"
                  checked={checked}
                  onChange={() => toggleType(type)}
                  style={checked ? { background: info.color, borderColor: info.color } : undefined}
                />
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: info.color }} />
                <span className="filter-label text-xs text-[var(--text2)] whitespace-nowrap">{info.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative w-full h-[200px] overflow-hidden bg-[var(--bg3)]"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleCanvasClick}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
        {tooltip && (
          <div
            className="absolute pointer-events-none z-10 px-2.5 py-1.5 bg-[rgba(24,24,27,0.95)] border border-[var(--border2)] rounded-md text-xs text-[var(--text)] whitespace-nowrap -translate-x-1/2 -translate-y-full -mt-2 shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <span className="font-semibold mr-1.5">
              {getTechniqueInfo(tooltip.technique.type).label}
            </span>
            <span className="text-[var(--text2)]">
              {formatTime(tooltip.technique.startTime)} ~ {formatTime(tooltip.technique.endTime)}
            </span>
          </div>
        )}
      </div>

      {/* Summary panel */}
      <div className="grid grid-cols-[1fr_auto] border-t border-[var(--border)] max-sm:grid-cols-1">
        {/* Bar chart */}
        <div className="px-5 py-3.5 border-r border-[var(--border)] max-sm:border-r-0 max-sm:border-b max-sm:border-[var(--border)]">
          <div className="text-xs font-semibold text-[var(--text2)] mb-2.5 uppercase tracking-wide">테크닉 사용 횟수</div>
          <div className="flex flex-col gap-[5px] max-h-[200px] overflow-y-auto">
            {techniqueStats.map(([type, count]) => {
              const info = getTechniqueInfo(type);
              const isTop = count === maxCount;
              return (
                <div
                  key={type}
                  className={`${"flex items-center gap-2"} ${isTop ? "[&_.bar-label]:text-[var(--text)] [&_.bar-label]:font-semibold" : ''}`}
                >
                  <span className="text-[11px] text-[var(--text2)] min-w-[56px] text-right shrink-0">{info.label}</span>
                  <div className="flex-1 h-2.5 bg-[var(--surface2)] rounded-[5px] overflow-hidden">
                    <div
                      className="h-full rounded-[5px] transition-[width] duration-[400ms] ease-out min-w-[2px]"
                      style={{
                        width: `${(count / maxCount) * 100}%`,
                        background: info.color,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-[var(--muted)] min-w-[24px] text-right font-[Inter,monospace]">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Difficulty & summary */}
        <div className="px-5 py-3.5 flex flex-col items-center justify-center gap-2.5 min-w-[140px]">
          <span className="text-xs text-[var(--muted)] uppercase tracking-wide font-semibold">곡 난이도</span>
          <span className={`${"inline-flex items-center justify-center px-[18px] py-1.5 rounded-md text-sm font-bold"} ${difficulty.cls}`}>
            {difficulty.label}
          </span>
          <span className="text-xs text-[var(--muted)]">
            테크닉 {uniqueTypeCount}종 / {vocalMap.length}회
          </span>
          {topTechnique && (
            <div className="text-xs text-[var(--text2)] text-center">
              가장 많이 사용: <span className="font-semibold text-[var(--text)]">{topTechnique.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Detail popup */}
      {selectedTechnique && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center" onClick={() => setSelectedTechnique(null)}>
          <div className="bg-[var(--bg2)] border border-[var(--border2)] rounded-xl p-6 min-w-[300px] max-w-[400px] shadow-[0_8px_40px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-3">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: getTechniqueInfo(selectedTechnique.type).color }}
              />
              <span className="text-lg font-bold text-[var(--text)]">
                {getTechniqueInfo(selectedTechnique.type).label}
              </span>
            </div>
            <p className="text-sm text-[var(--text2)] leading-relaxed mb-2">
              {getTechniqueInfo(selectedTechnique.type).description}
            </p>
            <p className="text-xs text-[var(--muted)] mb-4 font-[Inter,monospace]">
              {formatTime(selectedTechnique.startTime)} ~ {formatTime(selectedTechnique.endTime)}
              {' '}({(selectedTechnique.endTime - selectedTechnique.startTime).toFixed(1)}s)
            </p>
            <div className="flex gap-2">
              <button className={`${"flex-1 px-3.5 py-2 text-xs font-semibold rounded-md cursor-pointer transition-colors border-none"} ${"text-[var(--accent-lt)] bg-blue-500/[0.12] border border-blue-500/25 hover:bg-blue-500/[0.22]"}`} onClick={handleListen}>
                이 구간 듣기
              </button>
              <button className={`${"flex-1 px-3.5 py-2 text-xs font-semibold rounded-md cursor-pointer transition-colors border-none"} ${"text-[var(--success-lt)] bg-green-500/[0.12] border border-green-500/25 hover:bg-green-500/[0.22]"}`} onClick={handlePractice}>
                이 구간 연습하기
              </button>
            </div>
            <button className="w-full mt-2.5 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text2)] text-xs cursor-pointer transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]" onClick={() => setSelectedTechnique(null)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
