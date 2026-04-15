'use client';

import { useCallback, useRef, useState } from 'react';
import { useScalePracticeStore } from '@/stores/scalePracticeStore';

interface UsePitchDetectionReturn {
  startDetection: () => Promise<void>;
  stopDetection: () => void;
  isDetecting: boolean;
}

export function usePitchDetection(): UsePitchDetectionReturn {
  const [isDetecting, setIsDetecting] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const setDetectedPitch = useScalePracticeStore((s) => s.setDetectedPitch);

  const startDetection = useCallback(async () => {
    const { PitchDetector } = await import('pitchy');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const buf = new Float32Array(analyser.fftSize);
    const detector = PitchDetector.forFloat32Array(analyser.fftSize);

    const detect = () => {
      analyser.getFloatTimeDomainData(buf);
      const [pitch, clarity] = detector.findPitch(buf, audioCtx.sampleRate);
      if (clarity > 0.8 && pitch > 50 && pitch < 2000) {
        setDetectedPitch(Math.round(pitch * 10) / 10);
      } else {
        setDetectedPitch(null);
      }
      rafRef.current = requestAnimationFrame(detect);
    };

    detect();
    setIsDetecting(true);
  }, [setDetectedPitch]);

  const stopDetection = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setDetectedPitch(null);
    setIsDetecting(false);
  }, [setDetectedPitch]);

  return { startDetection, stopDetection, isDetecting };
}
