'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { hlbCurriculum } from '@/lib/data/hlbCurriculum';
import { useScalePracticeStore } from '@/stores/scalePracticeStore';
import { useTonePlayer } from '@/lib/hooks/useTonePlayer';
import { usePitchDetection } from '@/lib/hooks/usePitchDetection';
import { useScaleWebSocket } from '@/lib/hooks/useScaleWebSocket';
import PianoKeyboard from '@/components/scale-practice/PianoKeyboard';
import ScalePatternEditor from '@/components/scale-practice/ScalePatternEditor';
import TransportBar from '@/components/scale-practice/TransportBar';
import FeedbackModeSelector from '@/components/scale-practice/FeedbackModeSelector';
import GuideSection from '@/components/scale-practice/GuideSection';
import TensionIndicator from '@/components/journey/TensionIndicator';
import SessionReportPanel from '@/components/journey/SessionReportPanel';
import AutoLessonFlow from '@/components/scale-practice/AutoLessonFlow';

interface Props { stageId: number }

export default function ScalePracticeClient({ stageId }: Props) {
  const router = useRouter();
  const stage = hlbCurriculum.find((s) => s.id === stageId);
  const {
    feedbackMode, isRecording, setIsRecording,
    setPattern, setBpm, lessonMode, setLessonMode, setLessonPhase,
  } = useScalePracticeStore();
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);

  const {
    isConnected, latestResult, report, tensionHistory,
    startSession, stopSession, voiceQueue, error: wsError,
  } = useScaleWebSocket();

  const { start: startTone, stop: stopTone, duckVolume, restoreVolume } = useTonePlayer({
    onScaleSetComplete: () => {
      if (feedbackMode === 'active' && voiceQueue.length > 0) {
        const blob = new Blob([voiceQueue[0]], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        duckVolume();
        const audio = new Audio(url);
        voiceAudioRef.current = audio;
        audio.onended = () => { restoreVolume(); URL.revokeObjectURL(url); };
        audio.play().catch(() => restoreVolume());
      }
    },
  });

  const { startDetection, stopDetection } = usePitchDetection();

  useEffect(() => {
    if (stage) { setPattern(stage.pattern); setBpm(stage.bpmRange[0]); }
  }, [stage, setPattern, setBpm]);

  useEffect(() => { setLessonPhase('guide'); }, [stageId, setLessonPhase]);

  const handlePlay = useCallback(async () => { await startTone(); }, [startTone]);
  const handleStop = useCallback(() => {
    stopTone();
    if (isRecording) { stopSession(); stopDetection(); setIsRecording(false); }
  }, [stopTone, isRecording, stopSession, stopDetection, setIsRecording]);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) { stopSession(); stopDetection(); setIsRecording(false); }
    else { await startSession(stageId, feedbackMode); await startDetection(); setIsRecording(true); }
  }, [isRecording, stageId, feedbackMode, startSession, stopSession, startDetection, stopDetection, setIsRecording]);

  useEffect(() => {
    if (report && voiceQueue.length > 0) {
      const blob = new Blob([voiceQueue[voiceQueue.length - 1]], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play().catch(() => {});
    }
  }, [report, voiceQueue]);

  if (!stage) {
    return <div className="sc-empty"><p>단계를 찾을 수 없습니다.</p></div>;
  }

  if (stage.pattern.length === 0) {
    return (
      <div className="sc-empty">
        <h2>{stage.name}</h2>
        <p>이 단계는 {stage.scaleType === '없음' ? '호흡/신체 훈련' : stage.scaleType}입니다.</p>
        <button onClick={() => router.push(`/journey/${stageId}`)} className="sc-link-btn">
          소리의 길에서 연습하기
        </button>
      </div>
    );
  }

  return (
    <div className="sc-root">
      <div className="sc-container">
        <header className="sc-header">
          <button className="sc-back" onClick={() => router.push('/scale-practice')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="sc-title-group">
            <span className="sc-block-label">{stage.block}</span>
            <h1 className="sc-title">{stage.name}</h1>
          </div>
          <div className="sc-mode-toggle">
            <button
              className={lessonMode === 'auto' ? 'active' : ''}
              onClick={() => setLessonMode('auto')}
            >레슨</button>
            <button
              className={lessonMode === 'free' ? 'active' : ''}
              onClick={() => setLessonMode('free')}
            >자유</button>
          </div>
          {isConnected && <span className="sc-live" />}
        </header>

        {lessonMode === 'auto' ? (
          <AutoLessonFlow stage={stage} />
        ) : (
          <div className="sc-free">
            <div className="sc-free-tags">
              <span>{stage.pronunciation}</span>
              <span>{stage.scaleType}</span>
              <span>BPM {stage.bpmRange[0]}–{stage.bpmRange[1]}</span>
            </div>

            <GuideSection
              videoId={(stage as unknown as { guideVideoId?: string | null }).guideVideoId ?? null}
              instructions={[
                `턱을 편하게 열어주세요`,
                `피아노를 따라 '${stage.pronunciation}~' 소리를 부드럽게 연결하세요`,
                `올라갈수록 배 아래쪽 압력을 느껴보세요`,
              ]}
              stageName={stage.name}
            />

            <div style={{ marginBottom: 12 }}><ScalePatternEditor /></div>
            <FeedbackModeSelector />
            <TransportBar onPlay={handlePlay} onStop={handleStop} onRecordToggle={handleRecordToggle} />
            <div style={{ marginBottom: 16 }}><PianoKeyboard /></div>

            {wsError && <p className="sc-error">{wsError}</p>}

            {feedbackMode !== 'quiet' && isRecording && (
              <div className="sc-tension-box">
                <TensionIndicator tension={latestResult?.tension ?? null} feedback={latestResult?.feedback ?? ''} />
              </div>
            )}

            {!isRecording && !report && (
              <p className="sc-question">{stage.somaticFeedback.observationQuestion}</p>
            )}

            <SessionReportPanel report={report} tensionHistory={tensionHistory} />
          </div>
        )}
      </div>

      <style jsx>{`
        .sc-root {
          min-height: 100vh;
          background: var(--bg-base);
          color: var(--text-primary);
        }
        .sc-container {
          max-width: 720px;
          margin: 0 auto;
          padding: 24px 24px 60px;
        }
        .sc-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }
        .sc-back {
          width: 32px; height: 32px; border-radius: 8px;
          border: 1px solid var(--border); background: transparent;
          color: var(--text-secondary); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .sc-back:hover { border-color: var(--border-subtle); color: var(--text-secondary); }
        .sc-title-group { flex: 1; }
        .sc-block-label {
          display: block; font-size: 11px; color: var(--text-muted);
          margin-bottom: 2px;
        }
        .sc-title {
          font-size: 20px; font-weight: 700; margin: 0;
          letter-spacing: -0.01em;
        }
        .sc-mode-toggle {
          display: flex; border-radius: 6px; overflow: hidden;
          border: 1px solid var(--border);
        }
        .sc-mode-toggle button {
          padding: 5px 12px; border: none; font-size: 12px;
          font-weight: 500; cursor: pointer;
          background: transparent; color: var(--text-muted);
          transition: all 0.15s;
        }
        .sc-mode-toggle button.active {
          background: var(--bg-elevated); color: var(--text-primary);
        }
        .sc-live {
          width: 6px; height: 6px; border-radius: 50%;
          background: #4a4; flex-shrink: 0;
          animation: livePulse 2s ease infinite;
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .sc-empty {
          min-height: 100vh; background: var(--bg-base); color: var(--text-primary);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 12px; padding: 24px; text-align: center;
        }
        .sc-link-btn {
          padding: 10px 20px; border-radius: 8px; border: none;
          background: var(--text-primary); color: var(--bg-base);
          font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .sc-free-tags {
          display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap;
        }
        .sc-free-tags span {
          font-size: 11px; padding: 3px 8px; border-radius: 4px;
          background: var(--bg-raised); color: var(--text-secondary);
        }
        .sc-error {
          font-size: 13px; color: #c66; text-align: center;
          padding: 10px; margin: 0 0 12px;
        }
        .sc-tension-box {
          padding: 16px; border-radius: 8px;
          background: var(--bg-elevated); margin-bottom: 12px;
        }
        .sc-question {
          font-size: 14px; color: var(--text-secondary); text-align: center;
          padding: 16px 0; margin: 0;
          border-top: 1px solid var(--border);
        }
      `}</style>
    </div>
  );
}
