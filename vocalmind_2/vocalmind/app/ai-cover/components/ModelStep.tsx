'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAiCoverStore } from '@/stores/aiCoverStore';
import { getModels, startTraining } from '@/lib/ai-cover';
import { createClient } from '@/lib/supabase/client';
import type { VoiceModel } from '@/types';

export default function ModelStep() {
  const { setStep, selectModel, selectedModelId } = useAiCoverStore();
  const [models, setModels] = useState<VoiceModel[]>([]);
  const [recordings, setRecordings] = useState<string[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [modelName, setModelName] = useState('');
  const [training, setTraining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadModels = useCallback(async () => {
    try {
      const data = await getModels();
      setModels(data);
    } catch (err) {
      console.error('모델 목록 로딩 실패:', err);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.storage
        .from('ai-cover-models')
        .list(user.id, { sortBy: { column: 'created_at', order: 'desc' } });
      if (data) {
        setRecordings(
          data.filter((f) => f.name.endsWith('.wav')).map((f) => `${user.id}/${f.name}`),
        );
      }
    })();
  }, []);

  useEffect(() => {
    const trainingModels = models.filter((m) => m.status === 'training' || m.status === 'pending');
    if (trainingModels.length === 0) return;
    const interval = setInterval(loadModels, 5000);
    return () => clearInterval(interval);
  }, [models, loadModels]);

  const togglePath = (path: string) => {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  };

  const handleTrain = async () => {
    if (!modelName.trim() || selectedPaths.length === 0) return;
    setTraining(true);
    setError(null);
    try {
      await startTraining(selectedPaths, modelName.trim());
      setModelName('');
      setSelectedPaths([]);
      await loadModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : '학습 요청 실패');
    } finally {
      setTraining(false);
    }
  };

  const handleSelectModel = (model: VoiceModel) => {
    selectModel(model);
  };

  const statusLabel: Record<string, string> = {
    pending: '대기 중',
    training: '학습 중...',
    completed: '완료',
    failed: '실패',
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-[1.1rem] font-semibold text-[var(--text-primary)] mb-3">새 모델 만들기</h2>

        {recordings.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {recordings.map((path) => (
              <label key={path} className="flex items-center gap-2 text-[0.85rem] text-[var(--text-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPaths.includes(path)}
                  onChange={() => togglePath(path)}
                  className="accent-purple-600 w-4 h-4"
                />
                <span>{path.split('/').pop()}</span>
              </label>
            ))}
          </div>
        )}

        <input
          className="w-full py-2.5 px-3 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-[0.9rem] mb-3 outline-none focus:border-purple-600 transition-colors"
          placeholder="모델 이름 (예: 내 목소리 v1)"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
        />

        <button
          className="w-full py-2.5 border-none rounded-xl bg-purple-600 text-white text-[0.95rem] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleTrain}
          disabled={training || !modelName.trim() || selectedPaths.length === 0}
        >
          {training ? '학습 요청 중...' : '모델 만들기'}
        </button>

        {error && <p className="text-[0.85rem] text-red-500 mt-2">{error}</p>}
      </div>

      {models.length > 0 && (
        <div className="bg-[var(--bg-raised)] border border-[var(--border)] rounded-xl p-5">
          <h2 className="text-[1.1rem] font-semibold text-[var(--text-primary)] mb-3">내 모델</h2>
          <ul className="list-none p-0 m-0 flex flex-col gap-2">
            {models.map((model) => (
              <li
                key={model.id}
                className={`flex items-center justify-between p-3 bg-[var(--bg-elevated)] border rounded-lg transition-colors ${
                  selectedModelId === model.id ? 'border-purple-600' : 'border-[var(--border)]'
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.9rem] text-[var(--text-primary)] font-medium">{model.name}</span>
                  <span
                    className={`text-xs ${
                      model.status === 'completed' ? 'text-green-500' :
                      model.status === 'failed' ? 'text-red-500' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {statusLabel[model.status] ?? model.status}
                  </span>
                </div>
                {model.status === 'completed' && (
                  <button
                    className="px-3 py-1.5 border border-purple-600 rounded-lg bg-transparent text-purple-600 text-[0.8rem] font-medium cursor-pointer hover:bg-purple-600/10 transition-colors"
                    onClick={() => handleSelectModel(model)}
                  >
                    {selectedModelId === model.id ? '선택됨' : '이 모델 사용'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3">
        <button
          className="flex-1 py-3 border border-[var(--border)] rounded-xl bg-transparent text-[var(--text-primary)] text-[0.95rem] cursor-pointer hover:bg-[var(--bg-hover)]"
          onClick={() => setStep('record')}
        >
          이전
        </button>
        <button
          className="flex-[2] py-3 border-none rounded-xl bg-purple-600 text-white text-[0.95rem] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => setStep('convert')}
          disabled={!selectedModelId}
        >
          다음: 변환
        </button>
      </div>
    </div>
  );
}
