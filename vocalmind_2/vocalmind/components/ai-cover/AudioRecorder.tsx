'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const val = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export default function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pcmBufferRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef(0);

  const monitorLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    setAudioLevel(sum / (data.length * 255));
    animFrameRef.current = requestAnimationFrame(monitorLevel);
  }, []);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);

    const chunks = pcmBufferRef.current;
    if (chunks.length > 0 && audioCtxRef.current) {
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      const sampleRate = audioCtxRef.current.sampleRate;
      const wavBlob = encodeWav(merged, sampleRate);
      const recordedDuration = totalLength / sampleRate;
      onRecordingComplete(wavBlob, recordedDuration);
    }

    pcmBufferRef.current = [];

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;

    setIsRecording(false);
    setAudioLevel(0);
  }, [onRecordingComplete]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferSize = 4096;
      const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      pcmBufferRef.current = [];

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        pcmBufferRef.current.push(new Float32Array(input));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      processorRef.current = processor;

      setIsRecording(true);
      setDuration(0);
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);

      monitorLevel();
    } catch (err) {
      console.error('마이크 접근 실패:', err);
    }
  }, [monitorLevel]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const showDurationWarning = duration > 0 && duration < 10 && !isRecording;

  return (
    <div className="flex flex-col items-center px-4 py-10 gap-6">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`w-28 h-28 rounded-full border-none flex items-center justify-center cursor-pointer transition-all duration-300 ${
          isRecording
            ? 'bg-[var(--error,#ef4444)] shadow-[0_0_24px_rgba(239,68,68,0.5)] animate-pulse'
            : 'bg-gradient-to-br from-[var(--accent,#7c3aed)] to-[var(--accent-lt,#a855f7)] shadow-[0_0_24px_rgba(124,58,237,0.4)] hover:opacity-90 hover:scale-[1.04]'
        }`}
        type="button"
      >
        {isRecording ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      <p className="text-base font-medium text-[var(--text,#e5e5e5)]">
        {isRecording ? '녹음 중...' : '녹음 시작'}
      </p>

      {(isRecording || duration > 0) && (
        <div className="text-center">
          <p className="text-xs text-[var(--text2,#a3a3a3)]">경과 시간</p>
          <p className="text-[1.875rem] font-mono text-[var(--text,#e5e5e5)] mt-1">{formatTime(duration)}</p>
        </div>
      )}

      {isRecording && (
        <div className="w-64 flex items-end gap-0.5 h-8 justify-center">
          {Array.from({ length: 24 }).map((_, i) => {
            const barThreshold = (i + 1) / 24;
            const active = audioLevel >= barThreshold * 0.8;
            const barHeight = 4 + (i / 24) * 28;
            return (
              <div
                key={i}
                className="w-2 rounded-sm transition-[height] duration-75"
                style={{
                  height: `${active ? barHeight : 4}px`,
                  backgroundColor: active
                    ? i < 16 ? 'var(--accent)' : i < 20 ? 'var(--accent-light)' : 'var(--error)'
                    : 'var(--bg-hover)',
                }}
              />
            );
          })}
        </div>
      )}

      {showDurationWarning && (
        <p className="text-sm text-yellow-300">10초 이상 녹음을 권장합니다</p>
      )}
    </div>
  );
}
