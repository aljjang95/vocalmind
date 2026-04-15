'use client';

import { useScalePracticeStore } from '@/stores/scalePracticeStore';

const PRESETS: Record<string, number[]> = {
  '메이저': [0, 2, 4, 5, 7, 5, 4, 2, 0],
  '마이너': [0, 2, 3, 5, 7, 5, 3, 2, 0],
  '펜타': [0, 2, 4, 7, 9, 7, 4, 2, 0],
  '크로매틱': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  '아르페지오': [0, 4, 7, 12, 7, 4, 0],
  '옥타브': [0, 12, 0],
};

const START_NOTES = ['C2', 'D2', 'E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'C5'];

export default function ScalePatternEditor() {
  const { pattern, setPattern, startNote, setStartNote, bpm, setBpm, transposeRange, setTransposeRange } = useScalePracticeStore();

  const update = (i: number, v: string) => {
    const n = parseInt(v, 10);
    if (isNaN(n) || n < -1 || n > 24) return;
    const next = [...pattern];
    next[i] = n;
    setPattern(next);
  };

  return (
    <div style={{
      borderRadius: 12, padding: 16,
      background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
      border: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(12px)',
    }}>
      {/* 프리셋 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {Object.entries(PRESETS).map(([name, p]) => {
          const active = JSON.stringify(pattern) === JSON.stringify(p);
          return (
            <button key={name} onClick={() => setPattern(p)} style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              letterSpacing: '0.02em',
              fontFamily: "'SF Pro Text', -apple-system, sans-serif",
              background: active
                ? 'linear-gradient(135deg, #d97706, #b45309)'
                : 'rgba(255,255,255,0.06)',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: active ? '0 2px 12px rgba(217,119,6,0.3)' : 'none',
            }}>
              {name}
            </button>
          );
        })}
      </div>

      {/* 패턴 숫자 */}
      <div style={{ marginBottom: 14 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>패턴</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
          {pattern.map((val, i) => (
            <input
              key={i}
              type="number"
              min={-1} max={24}
              value={val}
              onChange={(e) => update(i, e.target.value)}
              style={{
                width: 38, height: 34, textAlign: 'center' as const, borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: val < 0
                  ? 'linear-gradient(135deg, var(--accent), var(--accent-hover))'
                  : 'rgba(255,255,255,0.04)',
                color: val < 0 ? 'var(--text-primary)' : 'var(--text-primary)',
                fontSize: 14, fontWeight: 600,
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          ))}
          <button onClick={() => setPattern([...pattern, 0])} style={smallBtn}>+</button>
          <button onClick={() => setPattern([...pattern, -1])} style={{ ...smallBtn, background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))', color: 'var(--text-primary)' }}>쉼</button>
          {pattern.length > 1 && <button onClick={() => setPattern(pattern.slice(0, -1))} style={smallBtn}>−</button>}
        </div>
      </div>

      {/* 설정 행 */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={labelStyle}>
          시작음
          <select value={startNote} onChange={(e) => setStartNote(e.target.value)} style={selectStyle}>
            {START_NOTES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          <span>BPM <strong style={{ color: 'var(--streak-gold)' }}>{bpm}</strong></span>
          <input type="range" min={40} max={200} value={bpm} onChange={(e) => setBpm(Number(e.target.value))}
            style={{ width: 90, accentColor: 'var(--warning)' }} />
        </label>

        <label style={labelStyle}>
          이동
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input type="number" min={-12} max={0} value={transposeRange[0]}
              onChange={(e) => setTransposeRange([Number(e.target.value), transposeRange[1]])} style={numStyle} />
            <span style={{ color: 'var(--text-muted)' }}>~</span>
            <input type="number" min={0} max={24} value={transposeRange[1]}
              onChange={(e) => setTransposeRange([transposeRange[0], Number(e.target.value)])} style={numStyle} />
          </div>
        </label>
      </div>
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', fontSize: 16,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
  letterSpacing: '0.05em',
};

const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
  padding: '4px 8px', fontSize: 13, fontWeight: 600,
  fontFamily: "'SF Mono', monospace",
};

const numStyle: React.CSSProperties = {
  width: 38, height: 28, textAlign: 'center' as const, borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
  color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
  fontFamily: "'SF Mono', monospace",
};
