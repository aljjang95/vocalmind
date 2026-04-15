'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { JourneyLessonPhase } from '@/types';
import type { SessionReport, TensionData } from '@/lib/hooks/useRealtimeEval';
import { hlbCurriculum } from '@/lib/data/hlbCurriculum';
import { useJourneyStore } from '@/stores/journeyStore';
import PaywallBanner from '@/components/journey/PaywallBanner';
import LessonProgress from '@/components/journey/LessonProgress';
import WhyPhase from '@/components/journey/phases/WhyPhase';
import DemoPhase from '@/components/journey/phases/DemoPhase';
import PracticePhase from '@/components/journey/phases/PracticePhase';
import EvalPhase from '@/components/journey/phases/EvalPhase';
import SummaryPhase from '@/components/journey/phases/SummaryPhase';

interface Props { stageId: number; }

export default function PracticeClient({ stageId }: Props) {
  const router = useRouter();
  const stage = hlbCurriculum.find((s) => s.id === stageId);
  const { canAccessStage } = useJourneyStore();

  const [phase, setPhase] = useState<JourneyLessonPhase>('why');
  const [report, setReport] = useState<SessionReport | null>(null);
  const [sessionTensionHistory, setSessionTensionHistory] = useState<TensionData[]>([]);
  const [passed, setPassed] = useState(false);

  const handlePracticeComplete = useCallback((sessionReport: SessionReport, history: TensionData[]) => {
    setReport(sessionReport);
    setSessionTensionHistory(history);
    if (sessionReport.stats) {
      const avgTension = sessionReport.stats.avg_tension;
      setPassed(avgTension < 40 && sessionReport.stats.chunk_count >= 3);
    }
    setPhase('eval');
  }, []);

  const handleRetry = useCallback(() => {
    setReport(null);
    setPassed(false);
    setPhase('practice');
  }, []);

  if (!stage) {
    return <div style={{ padding: 16, color: 'var(--text-primary)' }}>단계를 찾을 수 없습니다.</div>;
  }

  if (!canAccessStage(stageId)) {
    // 19단계 이상이면서 free 유저면 PaywallBanner 표시
    if (stageId > 18) {
      return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', padding: 16, maxWidth: 512, margin: '0 auto' }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button
              onClick={() => router.push('/journey')}
              style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
            >
              &larr;
            </button>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{stage?.blockIcon} {stage?.block}</div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{stage?.name}</h1>
            </div>
          </header>
          <PaywallBanner currentStage={stageId} />
        </div>
      );
    }

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 36 }}>--</p>
          <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>이전 단계를 먼저 완료해주세요.</p>
          <button
            onClick={() => router.push('/journey')}
            style={{ marginTop: 16, color: 'var(--accent-light)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            여정으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', padding: 24, maxWidth: 672, margin: '0 auto' }}>
      {/* 헤더 */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.push('/journey')}
          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
        >
          &larr;
        </button>
        <div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{stage.block}</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{stage.name}</h1>
        </div>
      </header>

      {/* 5-Phase 진행 바 */}
      <LessonProgress currentPhase={phase} />

      {/* Phase 렌더링 */}
      {phase === 'why' && (
        <WhyPhase stage={stage} onNext={() => setPhase('demo')} />
      )}

      {phase === 'demo' && (
        <DemoPhase stage={stage} onNext={() => setPhase('practice')} />
      )}

      {phase === 'practice' && (
        <PracticePhase
          stage={stage}
          stageId={stageId}
          onComplete={handlePracticeComplete}
        />
      )}

      {phase === 'eval' && report && (
        <EvalPhase
          stage={stage}
          stageId={stageId}
          report={report}
          tensionHistory={sessionTensionHistory}
          onNext={() => setPhase('summary')}
        />
      )}

      {phase === 'summary' && (
        <SummaryPhase
          stage={stage}
          stageId={stageId}
          passed={passed}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}
