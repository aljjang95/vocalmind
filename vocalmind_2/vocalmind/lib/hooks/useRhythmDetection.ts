'use client';

import { useCallback, useRef, useState } from 'react';
import type {
  BeatGrid,
  RhythmClassification,
  RhythmEvent,
  RhythmSectionScore,
  RhythmSessionScore,
} from '@/types';

// HTTP URL → WS URL 변환
function getWsUrl(): string {
  const httpUrl =
    process.env.NEXT_PUBLIC_VOCAL_BACKEND_URL ??
    process.env.VOCAL_BACKEND_URL ??
    'http://localhost:8001';
  return httpUrl.replace(/^http/, 'ws');
}

const CHUNK_INTERVAL_MS = 2000;

// 서버 → 클라이언트 메시지 타입
interface WsReadyMsg { type: 'ready' }
interface WsOnsetsMsg {
  type: 'onsets';
  chunk_start_sec: number;
  chunk_onset_count: number;
  events: Array<{
    onset_time_sec: number;
    target_beat_time_sec: number | null;
    error_ms: number | null;
    classification: RhythmClassification;
    section_index: number;
  }>;
}
interface WsReportMsg {
  type: 'report';
  rhythm_score: number;
  coverage_ratio: number;
  section_scores: Array<{
    section_index: number;
    label: string;
    score: number;
    event_count: number;
  }>;
  problem_segments: Array<{
    section_index: number;
    label: string;
    score: number;
    event_count: number;
  }>;
}
interface WsErrorMsg { type: 'error'; message: string }

type WsMsg = WsReadyMsg | WsOnsetsMsg | WsReportMsg | WsErrorMsg;

export interface RhythmSessionInput {
  beatGrid: BeatGrid;
  outputLatencyMs: number;
  sections?: Array<{ start_sec: number; end_sec: number; label: string }>;
}

interface UseRhythmDetectionReturn {
  isRecording: boolean;
  isConnected: boolean;
  lastClassification: RhythmClassification | null;
  sessionScore: RhythmSessionScore | null;
  error: string | null;
  startSession: (input: RhythmSessionInput) => Promise<void>;
  stopSession: () => void;
}

/**
 * 리듬 분석 세션 훅 — 마이크 청크를 WebSocket으로 스트리밍하고 결과를 수신한다.
 *
 * 서버 응답을 state로 반영하되, 매 청크마다 lastClassification을 업데이트해
 * UI에서 실시간 색상 피드백을 가능하게 한다.
 */
export function useRhythmDetection(): UseRhythmDetectionReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastClassification, setLastClassification] =
    useState<RhythmClassification | null>(null);
  const [sessionScore, setSessionScore] = useState<RhythmSessionScore | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;
    recorderRef.current = null;
    setIsRecording(false);
    setIsConnected(false);
  }, []);

  const startSession = useCallback(
    async (input: RhythmSessionInput) => {
      setError(null);
      setSessionScore(null);
      setLastClassification(null);

      const wsUrl = getWsUrl();
      const ws = new WebSocket(`${wsUrl}/ws/rhythm`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        ws.send(
          JSON.stringify({
            type: 'start',
            beat_grid: {
              bpm: input.beatGrid.bpm,
              first_beat_offset_sec: input.beatGrid.firstBeatOffsetSec,
              beat_times: input.beatGrid.beatTimes,
              source: input.beatGrid.source,
            },
            output_latency_ms: input.outputLatencyMs,
            sections: input.sections ?? [],
          })
        );
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        let data: WsMsg;
        try {
          data = JSON.parse(event.data) as WsMsg;
        } catch {
          return;
        }

        if (data.type === 'onsets') {
          // 가장 최근 분류 = 마지막 매칭 이벤트 (미리보기)
          const last = data.events.at(-1);
          if (last) setLastClassification(last.classification);
        } else if (data.type === 'report') {
          const events: RhythmEvent[] = [];
          // events는 report에 포함되지 않음 — session score 집계만 전달
          const sectionScores: RhythmSectionScore[] = data.section_scores.map((s) => ({
            sectionIndex: s.section_index,
            label: s.label,
            score: s.score,
            eventCount: s.event_count,
          }));
          const problemSegments: RhythmSectionScore[] = data.problem_segments.map((s) => ({
            sectionIndex: s.section_index,
            label: s.label,
            score: s.score,
            eventCount: s.event_count,
          }));
          setSessionScore({
            rhythmScore: data.rhythm_score,
            events,
            sectionScores,
            problemSegments,
            coverageRatio: data.coverage_ratio,
          });
          setIsRecording(false);
        } else if (data.type === 'error') {
          setError(data.message);
        }
      };

      ws.onerror = () => {
        setError('WebSocket 연결 실패');
        cleanup();
      };
      ws.onclose = () => {
        setIsConnected(false);
        setIsRecording(false);
      };

      // 마이크 스트림
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };

        const waitOpen = () => {
          if (ws.readyState === WebSocket.OPEN) {
            recorder.start(CHUNK_INTERVAL_MS);
            setIsRecording(true);
          } else if (ws.readyState === WebSocket.CONNECTING) {
            setTimeout(waitOpen, 50);
          }
        };
        waitOpen();
      } catch {
        setError('마이크 접근 권한이 필요합니다.');
        cleanup();
      }
    },
    [cleanup]
  );

  const stopSession = useCallback(() => {
    const recorder = recorderRef.current;
    const ws = wsRef.current;

    if (recorder?.state === 'recording') {
      recorder.onstop = () => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'end' }));
        }
      };
      recorder.stop();
    } else if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'end' }));
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsRecording(false);
  }, []);

  return {
    isRecording,
    isConnected,
    lastClassification,
    sessionScore,
    error,
    startSession,
    stopSession,
  };
}
