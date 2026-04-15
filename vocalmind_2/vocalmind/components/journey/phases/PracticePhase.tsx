'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HLBCurriculumStage } from '@/types';
import type { SessionReport, TensionData } from '@/lib/hooks/useRealtimeEval';
import { useRealtimeEval } from '@/lib/hooks/useRealtimeEval';
import { useDemoPitch } from '@/lib/hooks/useDemoPitch';
import PitchVisualizer from '@/components/journey/PitchVisualizer';
import PitchComparisonVisualizer from '@/components/journey/PitchComparisonVisualizer';
import TensionIndicator from '@/components/journey/TensionIndicator';
import LiveFeedbackToast from '@/components/journey/LiveFeedbackToast';
import VoiceVisualizer from '@/components/journey/VoiceVisualizer';

interface Props {
  stage: HLBCurriculumStage;
  stageId: number;
  onComplete: (report: SessionReport, tensionHistory: TensionData[]) => void;
}

function classifyFeedback(feedback: string): 'positive' | 'neutral' | 'correction' {
  if (!feedback) return 'neutral';
  const lower = feedback.toLowerCase();
  if (lower.includes('좋') || lower.includes('잘') || lower.includes('편안') || lower.includes('유지')) {
    return 'positive';
  }
  if (lower.includes('긴장') || lower.includes('힘') || lower.includes('조') || lower.includes('올라')) {
    return 'correction';
  }
  return 'neutral';
}

const PITCH_HISTORY_MAX = 50;

interface StudentPitch {
  time: number;
  frequency: number;
}

export default function PracticePhase({ stage, stageId, onComplete }: Props) {
  const {
    isRecording, isConnected, latestResult, report,
    tensionHistory, startSession, stopSession, error,
  } = useRealtimeEval();

  const hasDemo = !!stage.demoAudioUrl;
  const demoPitch = useDemoPitch(hasDemo ? stage.demoAudioUrl : undefined);
  const [compareMode, setCompareMode] = useState(true);
  const [studentPitches, setStudentPitches] = useState<StudentPitch[]>([]);
  const recordingStartRef = useRef<number>(0);

  const completedRef = useRef(false);
  const [pitchHistory, setPitchHistory] = useState<number[]>([]);

  // report 도착 시 onComplete 호출 (1회만)
  useEffect(() => {
    if (report && !completedRef.current) {
      completedRef.current = true;
      onComplete(report, tensionHistory);
    }
  }, [report, onComplete]);

  // Accumulate pitch history from analysis chunks
  useEffect(() => {
    if (latestResult) {
      const pitch = latestResult.avg_pitch_hz ?? 0;
      setPitchHistory((prev) => {
        const next = [...prev, pitch];
        return next.length > PITCH_HISTORY_MAX ? next.slice(-PITCH_HISTORY_MAX) : next;
      });

      // 비교 모드용 학생 피치 수집
      if (compareMode && hasDemo && recordingStartRef.current > 0) {
        const elapsed = (Date.now() - recordingStartRef.current) / 1000;
        setStudentPitches((prev) => [...prev, { time: elapsed, frequency: pitch }]);
      }
    }
  }, [latestResult, compareMode, hasDemo]);

  const handleToggle = useCallback(() => {
    if (isRecording) {
      stopSession();
    } else {
      completedRef.current = false;
      setPitchHistory([]);
      setStudentPitches([]);
      recordingStartRef.current = Date.now();
      startSession(stageId);
    }
  }, [isRecording, stopSession, startSession, stageId]);

  const targetPitches = stage.pattern.map((semitone) => 261.6 * Math.pow(2, semitone / 12));

  const feedbackMsg = latestResult?.feedback ?? null;
  const feedbackType = feedbackMsg ? classifyFeedback(feedbackMsg) : 'neutral';

  return (
    <div className="flex flex-col gap-4">
      {isConnected && (
        <div className="flex items-center justify-end gap-1 text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          실시간
        </div>
      )}

      <div className="p-3 bg-white/[0.03] border border-white/[0.08] rounded-[10px]">
        <p className="text-[13px] text-white/70">
          발음: <strong>{stage.pronunciation}</strong> / BPM: {stage.bpmRange[0]}~{stage.bpmRange[1]} / {stage.scaleType}
        </p>
        <p className="text-xs text-white/40 mt-1">{stage.evaluationCriteria.description}</p>
      </div>

      {/* 비교 모드 토글 (시범 오디오가 있는 단계만) */}
      {hasDemo && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)]">
            {compareMode ? '따라하기 모드' : '자유 연습'}
          </span>
          <button
            type="button"
            onClick={() => setCompareMode(!compareMode)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              compareMode ? 'bg-[var(--accent)]' : 'bg-white/10'
            }`}
            aria-label="비교 모드 토글"
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              compareMode ? 'left-[22px]' : 'left-0.5'
            }`} />
          </button>
        </div>
      )}

      {/* 비교 모드 ON + 시범 피치 로드 완료 */}
      {hasDemo && compareMode && !demoPitch.error ? (
        <>
          {demoPitch.isLoading ? (
            <div className="flex items-center justify-center min-h-[220px] bg-white/[0.02] border border-white/[0.08] rounded-lg">
              <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <div className="w-4 h-4 border-2 border-white/20 border-t-[var(--accent)] rounded-full animate-spin" />
                선생님 피치 분석 중...
              </div>
            </div>
          ) : (
            <PitchComparisonVisualizer
              referencePitches={demoPitch.referencePitches}
              studentPitches={studentPitches}
              isRecording={isRecording}
              duration={demoPitch.duration}
            />
          )}

          {/* 긴장 지도는 비교 모드에서도 유지 */}
          <VoiceVisualizer
            isRecording={isRecording}
            currentPitch={latestResult?.avg_pitch_hz}
            tensionData={latestResult?.tension ? {
              laryngeal: latestResult.tension.laryngeal,
              tongueRoot: latestResult.tension.tongue_root,
              jaw: latestResult.tension.jaw,
              registerBreak: latestResult.tension.register_break,
            } : undefined}
            pitchHistory={pitchHistory}
          />
        </>
      ) : (
        /* 기존 모드 (비교 OFF 또는 시범 없음) */
        <>
          <VoiceVisualizer
            isRecording={isRecording}
            currentPitch={latestResult?.avg_pitch_hz}
            tensionData={latestResult?.tension ? {
              laryngeal: latestResult.tension.laryngeal,
              tongueRoot: latestResult.tension.tongue_root,
              jaw: latestResult.tension.jaw,
              registerBreak: latestResult.tension.register_break,
            } : undefined}
            pitchHistory={pitchHistory}
          />

          <PitchVisualizer
            targetPitches={targetPitches}
            currentPitch={null}
            isActive={isRecording}
          />
        </>
      )}

      <div className="flex justify-center py-5">
        <button
          className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl border-none cursor-pointer text-white transition-all hover:scale-105 ${
            isRecording ? 'bg-red-600' : 'bg-[var(--accent)]'
          }`}
          onClick={handleToggle}
        >
          {isRecording ? '\u23F9' : '\uD83C\uDFA4'}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[13px] text-red-300 text-center">
          {error}
        </div>
      )}

      {isRecording && (
        <>
          <TensionIndicator
            tension={latestResult?.tension ?? null}
            feedback={latestResult?.feedback ?? ''}
          />
          <LiveFeedbackToast message={feedbackMsg} type={feedbackType} />
        </>
      )}
    </div>
  );
}
