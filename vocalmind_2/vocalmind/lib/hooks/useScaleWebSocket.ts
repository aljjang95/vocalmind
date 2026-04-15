'use client';

import { useCallback, useRef, useState } from 'react';
import type { FeedbackMode } from '@/types';
import type { TensionData, SessionReport } from './useRealtimeEval';

const WS_URL = process.env.NEXT_PUBLIC_WS_BACKEND_URL ?? 'ws://localhost:8001';
const CHUNK_INTERVAL_MS = 2000;

interface UseScaleWebSocketReturn {
  isConnected: boolean;
  latestResult: { tension: TensionData | null; feedback: string } | null;
  report: SessionReport | null;
  tensionHistory: TensionData[];
  startSession: (stageId: number, feedbackMode: FeedbackMode) => Promise<void>;
  stopSession: () => void;
  voiceQueue: ArrayBuffer[];
  error: string | null;
}

export function useScaleWebSocket(): UseScaleWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [latestResult, setLatestResult] = useState<{ tension: TensionData | null; feedback: string } | null>(null);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [tensionHistory, setTensionHistory] = useState<TensionData[]>([]);
  const [voiceQueue, setVoiceQueue] = useState<ArrayBuffer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startSession = useCallback(async (stageId: number, feedbackMode: FeedbackMode) => {
    setError(null);
    setReport(null);
    setLatestResult(null);
    setTensionHistory([]);
    setVoiceQueue([]);

    const ws = new WebSocket(`${WS_URL}/ws/scale-practice`);
    wsRef.current = ws;

    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'start', stage_id: stageId, feedback_mode: feedbackMode }));
    };

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const data = JSON.parse(event.data);
        if (data.type === 'analysis') {
          setLatestResult({ tension: data.tension, feedback: data.feedback });
          if (data.tension) {
            setTensionHistory((prev) => [...prev, data.tension]);
          }
        } else if (data.type === 'report') {
          setReport(data as SessionReport);
        }
      } else {
        // 바이너리 = AI 음성 (MP3)
        setVoiceQueue((prev) => [...prev, event.data as ArrayBuffer]);
      }
    };

    ws.onerror = () => setError('WebSocket 연결 실패');
    ws.onclose = () => setIsConnected(false);

    // 마이크 녹음 시작
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
        } else {
          setTimeout(waitOpen, 50);
        }
      };
      waitOpen();
    } catch {
      setError('마이크 접근 권한이 필요합니다.');
    }
  }, []);

  const stopSession = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
    }
  }, []);

  return { isConnected, latestResult, report, tensionHistory, startSession, stopSession, voiceQueue, error };
}
