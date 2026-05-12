'use client';

import { useCallback, useRef, useState } from 'react';

// HTTP URL → WS URL 자동 변환 (별도 환경변수 불필요)
function getWsUrl(): string {
  const httpUrl = process.env.NEXT_PUBLIC_VOCAL_BACKEND_URL ?? 'http://localhost:8001';
  return httpUrl.replace(/^http/, 'ws');
}

const CHUNK_INTERVAL_MS = 2000;
const MEDIA_PERMISSION_TIMEOUT_MS = 1500;

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
  const fallbackRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startFallback = useCallback((stageId: number, reason: string) => {
    fallbackRef.current = true;
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current);
    }

    const demoTension: TensionData = {
      overall: 28,
      laryngeal: 24,
      tongue_root: 31,
      jaw: 22,
      register_break: 18,
      detected: false,
      detail: '데모 분석 모드입니다. 실제 서버 연결이 복구되면 실시간 음성 분석으로 전환됩니다.',
    };

    let chunk = 0;
    const pushDemoChunk = () => {
      chunk += 1;
      const pitch = 260 + Math.sin(chunk / 2) * 18;
      setLatestResult({
        type: 'analysis',
        chunk_index: chunk,
        avg_pitch_hz: pitch,
        tension: demoTension,
        feedback: reason,
      });
      setTensionHistory((prev) => [...prev.slice(-24), demoTension]);
    };

    pushDemoChunk();
    fallbackTimerRef.current = setInterval(pushDemoChunk, CHUNK_INTERVAL_MS);
    setIsRecording(true);
    setIsConnected(false);
    setError(null);
  }, []);

  const cleanup = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    fallbackRef.current = false;
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
      cleanup();
      startFallback(stageId, '분석 서버 연결이 불안정해 데모 분석으로 진행합니다.');
    };
    ws.onclose = () => {
      setIsConnected(false);
      if (!fallbackRef.current) {
        setIsRecording(false);
      }
    };

    // 2) 마이크 스트림
    try {
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: true }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('MIC_PERMISSION_TIMEOUT')), MEDIA_PERMISSION_TIMEOUT_MS);
        }),
      ]);
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
    } catch (e) {
      const err = e instanceof DOMException ? e : null;
      cleanup();
      if (err?.name === 'NotFoundError') {
        startFallback(stageId, '마이크가 감지되지 않아 데모 분석으로 진행합니다.');
      } else if (err?.name === 'NotAllowedError') {
        startFallback(stageId, '마이크 권한이 없어 데모 분석으로 진행합니다.');
      } else {
        startFallback(stageId, '마이크를 시작할 수 없어 데모 분석으로 진행합니다.');
      }
    }
  }, [cleanup, startFallback]);

  const stopSession = useCallback(() => {
    const recorder = recorderRef.current;
    const ws = wsRef.current;

    if (fallbackRef.current) {
      setReport({
        type: 'report',
        summary: '데모 분석으로 실습 흐름을 완료했습니다.',
        improvements: '실제 분석 서버와 마이크 권한을 확인하면 더 정확한 피드백을 받을 수 있습니다.',
        focus_area: '혀뿌리와 턱 이완',
        exercise: '편안한 어 발음으로 3초 유지하기',
        encouragement: '좋습니다. 목 안쪽을 넓게 유지하는 감각을 계속 확인해보세요.',
        stats: {
          chunk_count: tensionHistory.length || 1,
          avg_tension: 28,
          max_tension: 31,
          min_tension: 18,
          tension_events: 0,
          main_issues: [],
          pitch_history: [],
          voiced_ratio: 1,
        },
      });
      cleanup();
      return;
    }

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
  }, [cleanup, tensionHistory.length]);

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
