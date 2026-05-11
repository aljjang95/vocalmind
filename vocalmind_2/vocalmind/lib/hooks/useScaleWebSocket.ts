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

  const cleanup = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;
    setIsConnected(false);
  }, []);

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

    ws.onerror = () => {
      setError('분석 서버에 연결하지 못했습니다. 백엔드 서버가 실행 중인지 확인해주세요.');
      cleanup();
    };
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
          if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
            setError('분석 서버 연결이 닫혔습니다. 잠시 후 다시 시도해주세요.');
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          setTimeout(waitOpen, 50);
        }
      };
      waitOpen();
    } catch (e) {
      const err = e instanceof DOMException ? e : null;
      if (err?.name === 'NotAllowedError') {
        setError('마이크 사용 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해주세요.');
      } else if (err?.name === 'NotFoundError') {
        setError('마이크를 찾을 수 없습니다. 입력 장치 연결을 확인해주세요.');
      } else {
        setError('마이크를 시작하지 못했습니다. 브라우저 설정과 입력 장치를 확인해주세요.');
      }
      cleanup();
    }
  }, [cleanup]);

  const stopSession = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
    }
    cleanup();
  }, [cleanup]);

  return { isConnected, latestResult, report, tensionHistory, startSession, stopSession, voiceQueue, error };
}
