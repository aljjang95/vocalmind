'use client';

import { useMemo } from 'react';
import type { SessionReport, TensionData } from '@/lib/hooks/useRealtimeEval';
import TTSButton from '@/components/shared/TTSButton';

interface Props {
  report: SessionReport | null;
  tensionHistory: TensionData[];
}

function buildReportText(report: SessionReport): string {
  const parts: string[] = [];
  if (report.summary) parts.push(report.summary);
  if (report.improvements) parts.push(`잘된 점: ${report.improvements}`);
  if (report.focus_area) parts.push(`집중 포인트: ${report.focus_area}`);
  if (report.exercise) parts.push(`추천 연습: ${report.exercise}`);
  if (report.encouragement) parts.push(report.encouragement);
  return parts.join('. ');
}

function barColor(overall: number): string {
  if (overall < 30) return 'rgba(52,211,153,0.7)';
  if (overall < 50) return 'rgba(234,179,8,0.7)';
  if (overall < 70) return 'rgba(249,115,22,0.7)';
  return 'rgba(239,68,68,0.7)';
}

export default function SessionReportPanel({ report, tensionHistory }: Props) {
  // 훅은 조건부 return 앞에 위치해야 함 (Rules of Hooks)
  const reportText = useMemo(() => (report ? buildReportText(report) : ''), [report]);

  if (!report) return null;

  const { stats } = report;
  const maxTension = Math.max(...tensionHistory.map((t) => t.overall), 1);

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 헤더 */}
      <div style={{ padding: 16, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>세션 리포트</h3>
          <TTSButton text={reportText} size="md" label="리포트 듣기" />
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{report.summary}</p>
      </div>

      {/* 긴장도 미니 그래프 */}
      {tensionHistory.length > 0 && (
        <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, margin: '0 0 8px' }}>긴장도 추이</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 48 }}>
            {tensionHistory.map((t, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderRadius: '2px 2px 0 0',
                  background: barColor(t.overall),
                  height: `${(t.overall / maxTension) * 100}%`,
                  minHeight: 2,
                  transition: 'all 0.2s',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>시작</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>종료</span>
          </div>
        </div>
      )}

      {/* 통계 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <div style={{ padding: 8, borderRadius: 6, background: 'var(--bg-elevated)', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{stats.chunk_count}</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>분석 횟수</div>
        </div>
        <div style={{ padding: 8, borderRadius: 6, background: 'var(--bg-elevated)', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{stats.avg_tension}</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>평균 긴장도</div>
        </div>
        <div style={{ padding: 8, borderRadius: 6, background: 'var(--bg-elevated)', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{stats.tension_events}</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>긴장 감지</div>
        </div>
      </div>

      {/* 피드백 섹션 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {report.improvements && (
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(6,47,26,0.2)', border: '1px solid rgba(6,78,59,0.3)' }}>
            <p style={{ fontSize: 12, color: 'var(--success)', marginBottom: 4, margin: '0 0 4px' }}>잘된 점</p>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{report.improvements}</p>
          </div>
        )}
        {report.focus_area && (
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(43,25,0,0.2)', border: '1px solid rgba(92,50,0,0.3)' }}>
            <p style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 4, margin: '0 0 4px' }}>다음 집중 포인트</p>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{report.focus_area}</p>
          </div>
        )}
        {report.exercise && (
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(7,16,43,0.2)', border: '1px solid rgba(30,58,138,0.3)' }}>
            <p style={{ fontSize: 12, color: 'var(--accent-light)', marginBottom: 4, margin: '0 0 4px' }}>추천 연습</p>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', margin: 0 }}>{report.exercise}</p>
          </div>
        )}
      </div>

      {/* 격려 */}
      <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)', padding: '8px 0', margin: 0 }}>{report.encouragement}</p>
    </div>
  );
}
