'use client';

import Link from 'next/link';
import { hlbCurriculum, blockNames } from '@/lib/data/hlbCurriculum';
import { useScalePracticeStore } from '@/stores/scalePracticeStore';

export default function ScalePracticePage() {
  const { unlockedStages } = useScalePracticeStore();
  const scaleStages = hlbCurriculum.filter((s) => s.pattern.length > 0);

  const blocks = blockNames
    .map((name) => ({ name, stages: scaleStages.filter((s) => s.block === name) }))
    .filter((b) => b.stages.length > 0);

  return (
    <div className="sp-root">
      <nav className="sp-nav">
        <Link href="/" className="sp-nav-logo">HLB 보컬스튜디오</Link>
        <div className="sp-nav-links">
          <Link href="/journey" className="sp-nav-link">소리의 길</Link>
          <Link href="/coach" className="sp-nav-link">AI 코치</Link>
          <Link href="/dashboard" className="sp-nav-link">대시보드</Link>
        </div>
      </nav>
      <div className="sp-container">
        <header className="sp-header">
          <h1>스케일 연습</h1>
          <p className="sp-sub">
            {unlockedStages.length}개 해금 · 전체 {scaleStages.length}단계
          </p>
        </header>

        <div className="sp-tiers">
          <span className="sp-tier" data-tier="relax">1–9 이완</span>
          <span className="sp-tier" data-tier="pitch">10–17 음정</span>
          <span className="sp-tier" data-tier="full">18–28 종합</span>
        </div>

        {blocks.map((block) => (
          <section key={block.name} className="sp-block">
            <h2 className="sp-block-title">{block.name}</h2>
            <div className="sp-list">
              {block.stages.map((stage) => {
                const unlocked = unlockedStages.includes(stage.id);
                return (
                  <Link
                    key={stage.id}
                    href={unlocked ? `/scale-practice/${stage.id}` : '#'}
                    onClick={(e) => { if (!unlocked) e.preventDefault(); }}
                    className={`sp-item ${unlocked ? '' : 'sp-locked'}`}
                  >
                    <span className="sp-num">{stage.id}</span>
                    <div className="sp-info">
                      <span className="sp-name">{stage.name}</span>
                      <span className="sp-meta">{stage.pronunciation} · {stage.scaleType}</span>
                    </div>
                    {unlocked ? (
                      <svg className="sp-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg className="sp-lock" width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                        <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <style jsx global>{`
        .sp-root {
          min-height: 100vh;
          background: var(--bg-base);
          color: var(--text-primary);
        }
        .sp-nav {
          position: sticky; top: 0; z-index: 100;
          background: var(--glass-bg); backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 20px; height: 52px;
        }
        .sp-nav-logo {
          font-weight: 700; font-size: 15px; color: var(--text-primary); text-decoration: none;
        }
        .sp-nav-links { display: flex; gap: 4px; }
        @media (max-width: 600px) { .sp-nav-links { display: none; } }
        .sp-nav-link {
          font-size: 13px; color: var(--text-secondary); text-decoration: none;
          padding: 6px 10px; border-radius: 6px;
        }
        .sp-nav-link:hover { color: var(--text-primary); background: var(--bg-hover); }
        .sp-container {
          max-width: 680px;
          margin: 0 auto;
          padding: 0 20px 60px;
        }
        .sp-header {
          padding: 32px 0 24px;
        }
        .sp-header h1 {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0;
          font-family: var(--font-display);
        }
        .sp-sub {
          font-size: 14px;
          color: var(--text-muted);
          margin: 6px 0 0;
        }
        .sp-tiers {
          display: flex;
          gap: 8px;
          margin-bottom: 32px;
          flex-wrap: wrap;
        }
        .sp-tier {
          font-size: 12px;
          font-weight: 500;
          padding: 5px 12px;
          border-radius: 6px;
          color: var(--text-secondary);
          background: var(--bg-raised);
        }
        .sp-tier[data-tier="relax"] { color: #b8a080; background: #1d1915; }
        .sp-tier[data-tier="pitch"] { color: #8090b8; background: #15171d; }
        .sp-tier[data-tier="full"] { color: #b88080; background: #1d1515; }
        .sp-block {
          margin-bottom: 28px;
        }
        .sp-block-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          letter-spacing: 0.03em;
          margin: 0 0 10px;
          padding-left: 2px;
        }
        .sp-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
          border-radius: 12px;
          overflow: hidden;
          background: var(--border);
        }
        .sp-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 18px;
          background: var(--bg-raised);
          color: inherit;
          text-decoration: none;
          transition: background 0.15s;
          cursor: pointer;
        }
        @media (max-width: 480px) {
          .sp-item { padding: 14px 14px; gap: 12px; }
        }
        .sp-item:hover {
          background: var(--bg-elevated);
        }
        .sp-item.sp-locked {
          opacity: 0.35;
          cursor: default;
        }
        .sp-item.sp-locked:hover {
          background: var(--bg-raised);
        }
        .sp-num {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted);
          width: 24px;
          text-align: right;
          flex-shrink: 0;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono);
        }
        .sp-info {
          flex: 1;
          min-width: 0;
        }
        .sp-name {
          display: block;
          font-size: 15px;
          font-weight: 500;
          line-height: 1.4;
        }
        .sp-meta {
          display: block;
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .sp-arrow {
          color: var(--text-dim);
          flex-shrink: 0;
        }
        .sp-lock {
          color: var(--text-muted);
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
