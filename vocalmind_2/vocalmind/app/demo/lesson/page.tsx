'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import s from './page.module.css';

const PHASES = [
  { label: '왜?', key: 'why' },
  { label: '시범', key: 'demo' },
  { label: '실습', key: 'practice' },
  { label: '평가', key: 'eval' },
  { label: '요약', key: 'summary' },
] as const;

const NAV = [
  { icon: '⊞', label: '홈' },
  { icon: '◎', label: '소리의 길', active: true },
  { icon: '♪', label: '스케일 연습' },
  { icon: '◈', label: 'AI 코치' },
  { icon: '▣', label: '스튜디오' },
];

const FEEDBACKS = [
  { hi: '턱에 힘이 조금 들어가고 있어요.', lo: '입을 자연스럽게 벌리고 아래턱을 부드럽게 내려보세요.' },
  { hi: '허뿌리 긴장이 감지돼요.', lo: '혀를 아래 잇몸에 살짝 내려놓고 이완해보세요.' },
  { hi: '좋아요! 후두가 안정됐어요.', lo: '이 상태를 유지하면서 계속 불러보세요.' },
  { hi: '성구전환 구간이에요.', lo: '음이 바뀌는 순간 긴장하지 말고 흘려보내세요.' },
];

function tensionColor(v: number) {
  if (v < 35) return '#10B981';
  if (v < 60) return '#F59E0B';
  return '#F43F5E';
}

function pad(n: number) { return n.toString().padStart(2, '0'); }
function fmt(sec: number) { return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`; }

// ── 파형 캔버스 ───────────────────────────────────────────────
function Waveform({ live }: { live: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  const off = useRef(0);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;

    const draw = () => {
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);

      // 그리드
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (H / 5) * i);
        ctx.lineTo(W, (H / 5) * i);
        ctx.stroke();
      }

      const o = off.current;

      // 선생님 — fill 영역
      const teachGrad = ctx.createLinearGradient(0, 0, 0, H);
      teachGrad.addColorStop(0, 'rgba(91,140,110,0.18)');
      teachGrad.addColorStop(1, 'rgba(91,140,110,0)');
      ctx.fillStyle = teachGrad;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x < W; x++) {
        const t = (x + o) * 0.025;
        const y = H / 2 + Math.sin(t) * 22 + Math.sin(t * 2.3) * 9 + Math.sin(t * 0.55) * 13;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      // 선생님 라인
      ctx.strokeStyle = '#5B8C6E';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let x = 0; x < W; x++) {
        const t = (x + o) * 0.025;
        const y = H / 2 + Math.sin(t) * 22 + Math.sin(t * 2.3) * 9 + Math.sin(t * 0.55) * 13;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // 내 목소리 — fill
      const myGrad = ctx.createLinearGradient(0, 0, 0, H);
      myGrad.addColorStop(0, 'rgba(154,208,172,0.12)');
      myGrad.addColorStop(1, 'rgba(154,208,172,0)');
      ctx.fillStyle = myGrad;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let x = 0; x < W; x++) {
        const t = (x + o) * 0.025;
        const noise = live ? Math.sin(t * 8.1) * 3.5 + Math.sin(t * 13.7) * 1.5 : 0;
        const y = H / 2 + Math.sin(t + 0.3) * 19 + Math.sin(t * 2.1) * 10 + Math.sin(t * 0.7) * 11 + noise;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();

      // 내 목소리 라인
      ctx.strokeStyle = '#9AD0AC';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = 'rgba(154,208,172,0.3)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let x = 0; x < W; x++) {
        const t = (x + o) * 0.025;
        const noise = live ? Math.sin(t * 8.1) * 3.5 + Math.sin(t * 13.7) * 1.5 : 0;
        const y = H / 2 + Math.sin(t + 0.3) * 19 + Math.sin(t * 2.1) * 10 + Math.sin(t * 0.7) * 11 + noise;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (live) off.current += 0.85;
      raf.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf.current);
  }, [live]);

  return (
    <canvas
      ref={ref}
      width={480}
      height={160}
      className={s.waveformCanvas}
    />
  );
}

// ── 메인 ─────────────────────────────────────────────────────
export default function LessonDemo() {
  const [live, setLive] = useState(true);
  const [sec, setSec] = useState(12);
  const [fbIdx, setFbIdx] = useState(0);
  const [tension, setTension] = useState({ l: 22, t: 58, j: 24, r: 50 });

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setSec(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [live]);

  useEffect(() => {
    const id = setInterval(() => {
      setTension(p => ({
        l: Math.max(8,  Math.min(75, p.l + (Math.random() - 0.5) * 11)),
        t: Math.max(30, Math.min(88, p.t + (Math.random() - 0.5) * 13)),
        j: Math.max(8,  Math.min(68, p.j + (Math.random() - 0.5) * 11)),
        r: Math.max(18, Math.min(78, p.r + (Math.random() - 0.5) * 15)),
      }));
    }, 950);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setFbIdx(i => (i + 1) % FEEDBACKS.length), 4500);
    return () => clearInterval(id);
  }, []);

  const toggle = useCallback(() => setLive(v => !v), []);

  const bars = [
    { label: '후두',   v: Math.round(tension.l) },
    { label: '허뿌리', v: Math.round(tension.t) },
    { label: '턱',     v: Math.round(tension.j) },
    { label: '성구',   v: Math.round(tension.r) },
  ];

  const fb = FEEDBACKS[fbIdx];
  const currentPhase = 2;

  return (
    <div className={s.root}>
      {/* 사이드바 */}
      <aside className={s.sidebar}>
        <div className={s.logo}>VocalMind</div>
        <nav className={s.nav}>
          {NAV.map(n => (
            <div key={n.label} className={`${s.navItem} ${n.active ? s.navItemActive : ''}`}>
              <span className={s.navIcon}>{n.icon}</span>
              <span>{n.label}</span>
            </div>
          ))}
        </nav>
      </aside>

      {/* 메인 */}
      <main className={s.main}>

        {/* 헤더 */}
        <header className={s.header}>
          <div className={s.breadcrumb}>
            <span>소리의 길</span>
            <span style={{ opacity: 0.35 }}>›</span>
            <span className={s.breadcrumbCurrent}>고글에서 전강하기로 흐름 잡아라</span>
          </div>
          <div className={s.headerRight}>
            <span className={s.timer}>41분 · {fmt(sec)}</span>
            <div className={s.avatar}>👤</div>
          </div>
        </header>

        {/* Phase 바 */}
        <div className={s.phaseBar}>
          <div className={s.phaseTrack}>
            <div className={s.phaseLine} />
            <div className={s.phaseLineDone} />
            {PHASES.map((p, i) => {
              const active = i === currentPhase;
              const done   = i < currentPhase;
              return (
                <div key={p.key} className={s.phaseStep}>
                  <div className={`${s.phaseDot} ${active ? s.phaseDotActive : done ? s.phaseDotDone : s.phaseDotDefault}`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`${s.phaseLabel} ${active ? s.phaseLabelActive : ''}`}>
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3열 콘텐츠 */}
        <div className={s.content}>

          {/* 좌: 파형 비교 */}
          <div className={s.panel}>
            <div className={s.panelTitle}>
              <span className={s.panelTitleText}>음원 비교 분석</span>
              <div className={s.legend}>
                <span><span className={s.legendDot} style={{ background: '#5B8C6E' }} />선생님</span>
                <span><span className={s.legendDot} style={{ background: '#9AD0AC' }} />내 목소리</span>
              </div>
            </div>

            <div className={s.waveformWrap}>
              <Waveform live={live} />
              <div className={s.waveformGlow} />
            </div>

            <div className={s.waveformStatus}>
              {live && <span className={s.waveformDot} />}
              <span>{live ? '실시간 피치 비교 중...' : '재생 버튼을 눌러 시작하세요'}</span>
            </div>

            <div className={s.statsGrid}>
              {[
                { label: '음정 정확도', val: '74%', good: true },
                { label: '음정 안정도', val: '81%', good: true },
              ].map(st => (
                <div key={st.label} className={s.statCard}>
                  <div className={s.statLabel}>{st.label}</div>
                  <div className={`${s.statValue} ${st.good ? s.statGood : s.statWarn}`}>{st.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 중: 녹음 버튼 */}
          <div className={`${s.panel} ${s.recordCenter}`}>
            <div className={s.recordButtonWrap}>
              {live && (
                <>
                  <div className={s.pulseRing} style={{ width: 152, height: 152 }} />
                  <div className={s.pulseRing} style={{ width: 174, height: 174, animationDelay: '0.7s' }} />
                </>
              )}
              <button
                onClick={toggle}
                className={`${s.recordBtn} ${live ? s.recordBtnActive : s.recordBtnIdle}`}
              >
                {live ? '🎙' : '▶'}
              </button>
            </div>

            <div className={s.timerDisplay}>{fmt(sec)}</div>

            <div className={s.recordStatus} style={{ color: live ? 'var(--accent-bright)' : 'var(--text-muted)' }}>
              {live && <span className={s.recDot} />}
              {live ? '녹음 중...' : '일시 중지됨'}
            </div>

            <div className={s.controls}>
              {[
                { icon: '⏮', label: '처음' },
                { icon: '⏸', label: '중지' },
                { icon: '⏹', label: '완료' },
              ].map(b => (
                <button key={b.label} title={b.label} className={s.controlBtn}>{b.icon}</button>
              ))}
            </div>

            <div className={s.exerciseTime}>
              <div className={s.exerciseLabel}>운동 시간</div>
              <div className={s.exerciseValue}>12:34</div>
            </div>
          </div>

          {/* 우: 긴장도 */}
          <div className={s.panel}>
            <div className={s.panelTitle}>
              <span className={s.panelTitleText}>실시간 긴장도 측정</span>
              <span className={s.liveBadge}>● LIVE</span>
            </div>

            <div className={s.tensionBars}>
              {bars.map(b => {
                const col = tensionColor(b.v);
                return (
                  <div key={b.label} className={s.tensionBar}>
                    <span className={s.tensionValue} style={{ color: col }}>{b.v}</span>
                    <div className={s.tensionTrack}>
                      <div className={s.tensionDangerLine} />
                      <div
                        className={s.tensionFill}
                        style={{
                          height: `${b.v}%`,
                          background: `linear-gradient(to top, ${col}, ${col}99)`,
                        }}
                      />
                      <div
                        className={s.tensionFillGlow}
                        style={{ bottom: `${b.v}%`, background: col }}
                      />
                    </div>
                    <span className={s.tensionLabel}>{b.label}</span>
                  </div>
                );
              })}
            </div>

            <div className={s.legend2}>
              <div className={s.legendTitle}>긴장도 기준</div>
              {[
                { label: '낮음 (0 – 34)', color: '#10B981' },
                { label: '보통 (35 – 59)', color: '#F59E0B' },
                { label: '높음 (60+)',     color: '#F43F5E' },
              ].map(r => (
                <div key={r.label} className={s.legendRow}>
                  <span className={s.legendCircle} style={{ background: r.color }} />
                  {r.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 피드백 바 */}
        <div className={s.feedbackBar}>
          <span className={s.feedbackIcon}>💬</span>
          <span className={s.feedbackText}>
            <span className={s.feedbackHighlight}>{fb.hi}</span>
            {' '}{fb.lo}
          </span>
        </div>

      </main>
    </div>
  );
}
