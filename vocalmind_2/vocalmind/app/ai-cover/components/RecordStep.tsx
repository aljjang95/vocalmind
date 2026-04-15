'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAiCoverStore } from '@/stores/aiCoverStore';
import { uploadRecording, insertRecording } from '@/lib/ai-cover';
import { createClient } from '@/lib/supabase/client';
import AudioRecorder from '@/components/ai-cover/AudioRecorder';
import FileDropZone from '@/components/ai-cover/FileDropZone';

interface RecordStepProps {
  userId: string;
  onRecordingSaved?: () => void;
}

interface Recording {
  name: string;
  path: string;
  created_at: string | null;
}

export default function RecordStep({ userId, onRecordingSaved }: RecordStepProps) {
  const { setStep } = useAiCoverStore();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecordings = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from('ai-cover-models')
      .list(userId, { sortBy: { column: 'created_at', order: 'desc' } });
    if (data) {
      setRecordings(
        data
          .filter((f) => f.name.endsWith('.wav'))
          .map((f) => ({
            name: f.name,
            path: `${userId}/${f.name}`,
            created_at: f.created_at,
          })),
      );
    }
  }, [userId]);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  const handleRecordingComplete = useCallback(
    async (blob: Blob, duration: number) => {
      setUploading(true);
      setError(null);
      try {
        const fileName = `recording_${Date.now()}.wav`;
        const storagePath = await uploadRecording(blob, fileName);
        await insertRecording(storagePath, duration, 'ai_cover_training');
        await loadRecordings();
        onRecordingSaved?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : '업로드 실패');
      } finally {
        setUploading(false);
      }
    },
    [loadRecordings, onRecordingSaved],
  );

  const handleFileSelected = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      try {
        const storagePath = await uploadRecording(file, file.name);
        // WAV/오디오 파일에서 duration 추출
        let duration = 0;
        try {
          const audioCtx = new AudioContext();
          const arrayBuf = await file.arrayBuffer();
          const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
          duration = audioBuf.duration;
          await audioCtx.close();
        } catch {
          // duration 추출 실패해도 업로드는 성공
        }
        await insertRecording(storagePath, duration, 'ai_cover_training');
        await loadRecordings();
        onRecordingSaved?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : '업로드 실패');
      } finally {
        setUploading(false);
      }
    },
    [loadRecordings, onRecordingSaved],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-[1.1rem] font-semibold text-[var(--text-primary)] mb-1">음성 녹음</h2>
        <p className="text-[0.85rem] text-[var(--text-secondary)] mb-4">모델 학습에 사용할 목소리를 녹음하세요. 최소 30초 이상 권장합니다.</p>
        <AudioRecorder onRecordingComplete={handleRecordingComplete} />
      </div>

      <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-[1.1rem] font-semibold text-[var(--text-primary)] mb-1">파일 업로드</h2>
        <p className="text-[0.85rem] text-[var(--text-secondary)] mb-4">이미 녹음된 파일이 있다면 업로드하세요.</p>
        <FileDropZone onFileSelected={handleFileSelected} disabled={uploading} />
      </div>

      {uploading && <p className="text-[0.85rem] text-purple-600 text-center">업로드 중...</p>}
      {error && <p className="text-[0.85rem] text-red-500 text-center">{error}</p>}

      {recordings.length > 0 && (
        <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-5">
          <h2 className="text-[1.1rem] font-semibold text-[var(--text-primary)] mb-1">녹음 목록</h2>
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            {recordings.map((r) => (
              <li key={r.path} className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-elevated)] rounded-lg">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                </svg>
                <span className="text-[0.85rem] text-[var(--text-primary)] overflow-hidden text-ellipsis whitespace-nowrap">{r.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        className="w-full py-3 border-none rounded-xl bg-purple-600 text-white text-base font-semibold cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        onClick={() => setStep('model')}
        disabled={recordings.length === 0}
      >
        다음: 모델 생성
      </button>
    </div>
  );
}
