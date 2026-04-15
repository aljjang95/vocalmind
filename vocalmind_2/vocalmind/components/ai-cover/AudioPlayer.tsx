'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface AudioPlayerProps {
  src: string | null;
  compareSrc?: string | null;
  label?: string;
  compareLabel?: string;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function AudioPlayer({
  src,
  compareSrc,
  label = '원본',
  compareLabel = '변환',
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [useCompare, setUseCompare] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const activeSrc = useCompare && compareSrc ? compareSrc : src;

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    cancelAnimationFrame(animFrameRef.current);
  }, [activeSrc]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#7c3aed';
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    animFrameRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  const setupAudioContext = useCallback(() => {
    if (!audioRef.current || audioCtxRef.current) return;

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    const sourceNode = audioCtx.createMediaElementSource(audioRef.current);
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    audioCtxRef.current = audioCtx;
    analyserRef.current = analyser;
    sourceNodeRef.current = sourceNode;
  }, []);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      cancelAnimationFrame(animFrameRef.current);
      setIsPlaying(false);
    } else {
      setupAudioContext();
      audioRef.current.play().catch(() => {});
      drawWaveform();
      setIsPlaying(true);
    }
  }, [isPlaying, setupAudioContext, drawWaveform]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = Number(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = Number(e.target.value);
      setVolume(vol);
      if (audioRef.current) {
        audioRef.current.volume = vol;
      }
    },
    [],
  );

  if (!src) return null;

  return (
    <div className="flex flex-col gap-4">
      <canvas
        ref={canvasRef}
        width={800}
        height={120}
        className="w-full rounded-xl bg-[var(--bg-elevated)]"
      />

      <div className="flex items-center gap-4">
        <button
          onClick={handlePlayPause}
          className="w-12 h-12 rounded-full border-none bg-gradient-to-br from-[var(--accent,#7c3aed)] to-[var(--accent-lt,#a855f7)] shadow-[0_0_16px_rgba(124,58,237,0.35)] flex items-center justify-center cursor-pointer shrink-0 transition-opacity hover:opacity-90"
          type="button"
        >
          {isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        <div className="flex-1 flex flex-col">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-[var(--accent,#7c3aed)] cursor-pointer"
          />
          <div className="flex justify-between text-xs text-[var(--text2,#a3a3a3)] mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {compareSrc && (
          <button
            onClick={() => setUseCompare((prev) => !prev)}
            className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all border ${
              useCompare
                ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-200'
                : 'border-purple-500/50 bg-purple-500/10 text-purple-300'
            }`}
            type="button"
          >
            {useCompare ? compareLabel : label}
          </button>
        )}

        <div className="flex items-center gap-2 flex-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--text2,#a3a3a3)] shrink-0">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            className="w-24 accent-[var(--accent,#7c3aed)]"
          />
          <span className="text-xs text-[var(--text2,#a3a3a3)] w-8 text-right">
            {Math.round(volume * 100)}
          </span>
        </div>
      </div>

      {activeSrc && (
        <audio
          ref={audioRef}
          src={activeSrc}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
          onEnded={() => {
            setIsPlaying(false);
            cancelAnimationFrame(animFrameRef.current);
          }}
          crossOrigin="anonymous"
        />
      )}
    </div>
  );
}
