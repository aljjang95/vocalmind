'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAiCoverStore } from '@/stores/aiCoverStore';
import { startConversion, getConversionStatus } from '@/lib/ai-cover';
import FileDropZone from '@/components/ai-cover/FileDropZone';

const STATUS_LABEL: Record<string, string> = {
  pending: '대기 중...',
  separating: '보컬 분리 중...',
  converting: '음성 변환 중...',
  mixing: '믹싱 중...',
  completed: '변환 완료!',
  failed: '변환 실패',
};

export default function ConvertStep() {
  const { selectedModel, setStep, conversionId, setConversionId } =
    useAiCoverStore();
  const [songFile, setSongFile] = useState<File | null>(null);
  const [pitchShift, setPitchShift] = useState(0);
  const [converting, setConverting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversionId) return;
    if (status === 'completed' || status === 'failed') return;
    const interval = setInterval(async () => {
      try {
        const data = await getConversionStatus(conversionId);
        setStatus(data.status);
        if (data.status === 'failed') {
          setError(data.error_message ?? '변환 중 오류 발생');
        }
      } catch (err) {
        console.error('상태 조회 실패:', err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [conversionId, status]);

  const handleConvert = useCallback(async () => {
    if (!songFile || !selectedModel) return;
    setConverting(true);
    setError(null);
    setStatus('pending');
    try {
      const { conversionId: id } = await startConversion(songFile, selectedModel.id, pitchShift);
      setConversionId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '변환 요청 실패');
      setStatus(null);
    } finally {
      setConverting(false);
    }
  }, [songFile, selectedModel, pitchShift, setConversionId]);

  const progressPct = (() => {
    switch (status) {
      case 'pending': return 10;
      case 'separating': return 30;
      case 'converting': return 60;
      case 'mixing': return 85;
      case 'completed': return 100;
      default: return 0;
    }
  })();

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-[1.1rem] font-semibold text-[var(--text-primary)] mb-1">선택된 모델</h2>
        <p className="text-[0.95rem] text-purple-600 font-medium">{selectedModel?.name ?? '모델 미선택'}</p>
      </div>

      <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-[1.1rem] font-semibold text-[var(--text-primary)] mb-1">노래 업로드</h2>
        <p className="text-[0.85rem] text-[var(--text-secondary)] mb-4">변환하고 싶은 노래 파일을 업로드하세요.</p>
        <FileDropZone
          onFileSelected={(file) => setSongFile(file)}
          disabled={converting || status === 'completed'}
        />
      </div>

      <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-[1.1rem] font-semibold text-[var(--text-primary)] mb-1">피치 조정</h2>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-[var(--text-secondary)] min-w-7 text-center">-24</span>
          <input
            type="range"
            min={-24}
            max={24}
            step={1}
            value={pitchShift}
            onChange={(e) => setPitchShift(Number(e.target.value))}
            className="flex-1 accent-purple-600 h-1.5"
          />
          <span className="text-xs text-[var(--text-secondary)] min-w-7 text-center">+24</span>
        </div>
        <p className="text-center text-[0.85rem] text-[var(--text-primary)] mt-2">
          {pitchShift > 0 ? `+${pitchShift}` : pitchShift} 반음
        </p>
      </div>

      {status && (
        <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-5">
          <p className="text-[0.95rem] text-[var(--text-primary)] font-medium mb-2">{STATUS_LABEL[status] ?? status}</p>
          <div className="h-1.5 bg-[var(--bg-elevated)] rounded overflow-hidden">
            <div
              className={`h-full rounded transition-[width] duration-500 ${status === 'failed' ? 'bg-red-500' : 'bg-purple-600'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {error && <p className="text-[0.85rem] text-red-500 text-center">{error}</p>}

      {status === 'completed' ? (
        <button
          className="w-full flex-[2] py-3 border-none rounded-xl bg-purple-600 text-white text-[0.95rem] font-semibold cursor-pointer"
          onClick={() => setStep('result')}
        >
          결과 확인
        </button>
      ) : (
        <div className="flex gap-3">
          <button
            className="flex-1 py-3 border border-[var(--border)] rounded-xl bg-transparent text-[var(--text-primary)] text-[0.95rem] cursor-pointer hover:bg-[var(--bg-hover)]"
            onClick={() => setStep('model')}
          >
            이전
          </button>
          <button
            className="flex-[2] py-3 border-none rounded-xl bg-purple-600 text-white text-[0.95rem] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleConvert}
            disabled={!songFile || !selectedModel || converting || !!conversionId}
          >
            {converting ? '변환 요청 중...' : '변환 시작'}
          </button>
        </div>
      )}
    </div>
  );
}
