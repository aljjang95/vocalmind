'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseAudioRecorderOptions {
  /** 자동 종료 시각(초). 미지정 시 수동 stop만 가능. */
  maxSeconds?: number;
  /** 선호 MIME. 지원 안 되면 audio/webm 폴백. */
  mimeType?: string;
  /** dataavailable 타임슬라이스(ms). 기본 250. */
  timesliceMs?: number;
  /** 녹음 완료 시 호출 (stop 또는 maxSeconds 도달). */
  onComplete?: (blob: Blob) => void;
  /** 마이크 권한 실패 등 오류. */
  onError?: (message: string) => void;
}

export interface UseAudioRecorderResult {
  isRecording: boolean;
  /** 현재 녹음 경과 시간 (초, 정수). */
  elapsed: number;
  /** 최종 녹음 결과. stop 전엔 null. */
  blob: Blob | null;
  /** 녹음 시작. 권한 거부 시 onError + 예외 throw. */
  start: () => Promise<void>;
  /** 수동 종료. 녹음 중이 아니면 no-op. */
  stop: () => void;
  /** blob + elapsed 초기화. */
  reset: () => void;
}

function resolveMimeType(preferred?: string): string {
  if (typeof window === 'undefined') return 'audio/webm';
  const candidates = preferred
    ? [preferred, 'audio/webm;codecs=opus', 'audio/webm']
    : ['audio/webm;codecs=opus', 'audio/webm'];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'audio/webm';
}

/**
 * MediaRecorder를 React 컴포넌트에서 일관되게 쓰기 위한 훅.
 *
 * - getUserMedia → MediaRecorder → Blob 변환 공통 파이프라인 제공
 * - 언마운트 시 stream tracks 자동 중지 (리소스 누수 방지)
 * - maxSeconds 지정 시 자동 종료
 * - 페이지 단순 녹음(hobby/vocal-dna/community 등)용. 실시간 WebSocket
 *   스트리밍은 별도 (useRealtimeEval, useScaleWebSocket).
 */
export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorderResult {
  const { maxSeconds, mimeType, timesliceMs = 250, onComplete, onError } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 콜백은 ref로 최신값 유지 — 녹음 중 effect dep에 넣지 않아 재시작 방지
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
  }, []);

  // 언마운트 가드: 진행 중이면 강제 정리
  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        try {
          recorderRef.current.stop();
        } catch {
          // 이미 종료된 경우 무시
        }
      }
      cleanup();
    };
  }, [cleanup]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state === 'recording') {
      rec.stop();
    }
  }, []);

  const reset = useCallback(() => {
    setBlob(null);
    setElapsed(0);
  }, []);

  const start = useCallback(async () => {
    if (isRecording) return;
    reset();
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const resolved = resolveMimeType(mimeType);
      const recorder = new MediaRecorder(stream, { mimeType: resolved });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: resolved });
        setBlob(finalBlob);
        setIsRecording(false);
        cleanup();
        onCompleteRef.current?.(finalBlob);
      };
      recorder.onerror = () => {
        setIsRecording(false);
        cleanup();
        onErrorRef.current?.('녹음 중 오류가 발생했습니다.');
      };

      recorder.start(timesliceMs);
      setIsRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (maxSeconds && next >= maxSeconds) {
            // maxSeconds 도달 → stop. onstop 핸들러가 정리
            recorderRef.current?.stop();
          }
          return next;
        });
      }, 1000);
    } catch {
      cleanup();
      setIsRecording(false);
      const msg = '마이크 권한을 허용해주세요.';
      onErrorRef.current?.(msg);
      throw new Error(msg);
    }
  }, [isRecording, mimeType, timesliceMs, maxSeconds, cleanup, reset]);

  return { isRecording, elapsed, blob, start, stop, reset };
}
