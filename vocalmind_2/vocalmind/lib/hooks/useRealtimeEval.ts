'use client';

import { useCallback, useRef, useState } from 'react';

// HTTP URL → WS URL 자동 변환 (별도 환경변수 불필요)
function getWsUrl(): string {
  const httpUrl = process.env.NEXT_PUBLIC_VOCAL_BACKEND_URL
    ?? process.env.VOCAL_BACKEND_URL
    ?? 'http://localhost:8001';
  return httpUrl.replace(/^http/, 'ws');
}

const CHUNK_INTERVAL_MS = 2000;

export interface TensionData {
  overall: number;
  laryngeal: number;
  tongue_root: number;
  jaw: number;
  register_break: number;
  detected: boolean;
  detail: string;
}

export interface ChunkResult {
  type: 'analysis';
  chunk_index: number;
  avg_pitch_hz: number;
  tension: TensionData | null;
  feedback: string;
}

export interface SessionReport {
  type: 'report';
  summary: string;
  improvements: string;
  focus_area: string;
  exercise: string;
  encouragement: string;
  stats: {
    chunk_count: number;
    avg_tension: number;
    max_tension: number;
    min_tension: number;
    tension_events: number;
    main_issues: string[];
    pitch_history?: number[];
    voiced_ratio?: number;
  };
}

interface UseRealtimeEvalReturn {
  isRecording: boolean;
  isConnected: boolean;
  latestResult: ChunkResult | null;
  report: SessionReport | null;
  tensionHistory: TensionData[];
  startSession: (stageId: number) => Promise<void>;
  stopSession: () => void;
  error: string | null;
}

export function useRealtimeEval(): UseRealtimeEvalReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [latestResult, setLatestResult] = useState<ChunkResult | null>(null);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [tensionHistory, setTensionHistory] = useState<TensionData[]>([]);
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

  const startSession = useCallback(async (stageId: number) => {
    setError(null);
    setReport(null);
    setLatestResult(null);
    setTensionHistory([]);

    // 1) WebSocket 연결
    const wsUrl = getWsUrl();
    const ws = new WebSocket(`${wsUrl}/ws/evaluate`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'start', stage_id: stageId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'analysis') {
        setLatestResult(data as ChunkResult);
        if (data.tension) {
          setTensionHistory((prev) => [...prev, data.tension]);
        }
      } else if (data.type === 'report') {
        setReport(data as SessionReport);
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

    // 2) 마이크 스트림
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

      // WebSocket이 열린 후 녹음 시작
      const waitOpen = () => {
        if (ws.readyState === WebSocket.OPEN) {
          recorder.start(CHUNK_INTERVAL_MS);
          setIsRecording(true);
        } else if (ws.readyState === WebSocket.CONNECTING) {
          setTimeout(waitOpen, 50);
        }
        // CLOSING/CLOSED면 폴링 중단 (onerror/onclose에서 cleanup)
      };
      waitOpen();
    } catch {
      setError('마이크 접근 권한이 필요합니다.');
      cleanup();
    }
  }, [cleanup]);

  const stopSession = useCallback(() => {
    const recorder = recorderRef.current;
    const ws = wsRef.current;

    if (recorder?.state === 'recording') {
      // stop() 시 ondataavailable가 마지막 청크를 전송한 후 onstop 발생
      recorder.onstop = () => {
        // 마지막 청크 전송 완료 후 end 신호
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
    latestResult,
    report,
    tensionHistory,
    startSession,
    stopSession,
    error,
  };
}
