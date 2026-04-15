'use client';

import { useState, useEffect } from 'react';
import { useAiCoverStore } from '@/stores/aiCoverStore';
import { getConversionStatus, getStorageUrl } from '@/lib/ai-cover';
import AudioPlayer from '@/components/ai-cover/AudioPlayer';
import type { AiCoverConversion } from '@/types';

export default function ResultStep() {
  const { conversionId, reset, setStep } = useAiCoverStore();
  const [conversion, setConversion] = useState<AiCoverConversion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversionId) return;
    (async () => {
      try {
        const data = await getConversionStatus(conversionId);
        setConversion(data);
      } catch (err) {
        console.error('결과 조회 실패:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [conversionId]);

  if (loading) {
    return <p className="text-center text-[var(--text-secondary)] py-12">결과를 불러오는 중...</p>;
  }

  if (!conversion || !conversion.output_path) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-center text-red-500 py-8">변환 결과를 찾을 수 없습니다.</p>
        <button className="w-full py-3 border-none rounded-xl bg-purple-600 text-white text-[0.95rem] font-semibold cursor-pointer hover:opacity-90" onClick={reset}>
          처음부터 다시
        </button>
      </div>
    );
  }

  const outputUrl = getStorageUrl('ai-cover-outputs', conversion.output_path);
  const originalUrl = conversion.song_id
    ? getStorageUrl('ai-cover-songs', conversion.song_id)
    : null;

  const handleDownload = async (format: 'wav' | 'mp3') => {
    const url = `${outputUrl}${format === 'mp3' ? '?format=mp3' : ''}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-cover.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRestart = () => {
    setStep('convert');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-[1.1rem] font-semibold text-[var(--text-primary)] mb-4">변환 결과</h2>
        <AudioPlayer
          src={outputUrl}
          compareSrc={originalUrl}
          label="원본"
          compareLabel="AI 커버"
        />
      </div>

      <div className="flex gap-3 max-[480px]:flex-col">
        <button
          className="flex-1 flex items-center justify-center gap-2 py-3 border border-purple-600 rounded-xl bg-transparent text-purple-600 text-[0.9rem] font-semibold cursor-pointer hover:bg-purple-600/10 transition-colors"
          onClick={() => handleDownload('wav')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          WAV 다운로드
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-2 py-3 border border-purple-600 rounded-xl bg-transparent text-purple-600 text-[0.9rem] font-semibold cursor-pointer hover:bg-purple-600/10 transition-colors"
          onClick={() => handleDownload('mp3')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          MP3 다운로드
        </button>
      </div>

      <div className="flex gap-3">
        <button className="flex-1 py-3 border-none rounded-xl bg-purple-600 text-white text-[0.95rem] font-semibold cursor-pointer hover:opacity-90" onClick={handleRestart}>
          다시 변환하기
        </button>
        <button className="flex-1 py-3 border border-[var(--border)] rounded-xl bg-transparent text-[var(--text-primary)] text-[0.95rem] cursor-pointer hover:bg-[var(--bg-hover)]" onClick={reset}>
          처음부터 다시
        </button>
      </div>
    </div>
  );
}
