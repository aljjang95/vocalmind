'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAiCoverStore } from '@/stores/aiCoverStore';
import { getTotalRecordingSec, getConversionStatus, getStorageUrl } from '@/lib/ai-cover';
import { createClient } from '@/lib/supabase/client';
import StepIndicator from './components/StepIndicator';
import UsageCounter from './components/UsageCounter';
import RecordStep from './components/RecordStep';
import ModelStep from './components/ModelStep';
import ConvertStep from './components/ConvertStep';
import ResultStep from './components/ResultStep';
import GrowthProgress from '@/components/ai-cover/GrowthProgress';
import EngineSelector from '@/components/ai-cover/EngineSelector';
import ABCompare from '@/components/ai-cover/ABCompare';
import type { SelectedEngine } from '@/components/ai-cover/EngineSelector';

interface AiCoverClientProps {
  userId: string;
}

type MainTab = 'quick' | 'rvc';

export default function AiCoverClient({ userId }: AiCoverClientProps) {
  const { currentStep } = useAiCoverStore();

  const [totalRecordingSec, setTotalRecordingSec] = useState<number>(0);

  useEffect(() => {
    getTotalRecordingSec().then(setTotalRecordingSec);
  }, []);
  const [activeTab, setActiveTab] = useState<MainTab>('quick');
  const [selectedEngine, setSelectedEngine] = useState<SelectedEngine>('hq_svc');
  const [showABCompare, setShowABCompare] = useState(false);

  // HQ-SVC / RVC 최신 변환 결과 오디오 URL
  const [hqSvcSrc, setHqSvcSrc] = useState<string | null>(null);
  const [rvcSrc, setRvcSrc] = useState<string | null>(null);

  // 비교 패널을 열기 전에 최신 완료된 변환 결과 URL을 조회
  const handleCompare = useCallback(async () => {
    const supabase = createClient();
    const { data: conversions } = await supabase
      .from('ai_cover_conversions')
      .select('id, engine, output_path')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('output_path', 'is', null)
      .in('engine', ['hq_svc', 'rvc'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (conversions) {
      const hqSvc = conversions.find((c) => c.engine === 'hq_svc');
      const rvc = conversions.find((c) => c.engine === 'rvc');
      setHqSvcSrc(hqSvc?.output_path ? getStorageUrl('ai-cover-outputs', hqSvc.output_path) : null);
      setRvcSrc(rvc?.output_path ? getStorageUrl('ai-cover-outputs', rvc.output_path) : null);
    }

    setShowABCompare(true);
  }, [userId]);

  const handlePreferenceSelect = useCallback((_preferred: 'hq_svc' | 'rvc') => {
    // 선호 데이터 수집 — 추후 Supabase에 저장
  }, []);

  return (
    <div className="max-w-[800px] mx-auto px-4 py-8 max-sm:px-3 max-sm:py-4">
      <h1 className="text-[1.75rem] font-bold text-[var(--text-primary)] mb-1 max-sm:text-[1.4rem]">
        AI 커버
      </h1>
      <p className="text-[var(--text-secondary)] text-[0.95rem] mb-6">
        내 목소리로 좋아하는 노래를 불러보세요
      </p>

      {/* 성장 진행률 위젯 */}
      <div className="mb-5">
        <GrowthProgress totalRecordingSec={totalRecordingSec} />
      </div>

      {/* 탭: 빠른 변환 vs RVC 경로 */}
      <div className="flex gap-0 border-b border-[var(--border-subtle)] mb-6">
        <button
          type="button"
          className={[
            'px-4 py-2.5 text-[0.9rem] font-medium border-none bg-transparent cursor-pointer transition-colors border-b-2 -mb-px',
            activeTab === 'quick'
              ? 'text-[var(--text-primary)] border-[var(--accent)]'
              : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]',
          ].join(' ')}
          onClick={() => setActiveTab('quick')}
        >
          빠른 변환
        </button>
        <button
          type="button"
          className={[
            'px-4 py-2.5 text-[0.9rem] font-medium border-none bg-transparent cursor-pointer transition-colors border-b-2 -mb-px',
            activeTab === 'rvc'
              ? 'text-[var(--text-primary)] border-[var(--accent)]'
              : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]',
          ].join(' ')}
          onClick={() => setActiveTab('rvc')}
        >
          내 목소리 학습 (RVC)
        </button>
      </div>

      {/* 빠른 변환 탭 */}
      {activeTab === 'quick' && (
        <div className="flex flex-col gap-5">
          <div className="bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-xl p-5">
            <h2 className="text-[1.05rem] font-semibold text-[var(--text-primary)] mb-1">
              HQ-SVC 즉시 변환
            </h2>
            <p className="text-[0.85rem] text-[var(--text-secondary)] mb-4">
              별도 학습 없이 바로 변환합니다. 짧은 녹음 샘플만 있으면 됩니다.
            </p>

            {/* 엔진 선택 */}
            <EngineSelector
              totalRecordingSec={totalRecordingSec}
              selectedEngine={selectedEngine}
              onSelectEngine={setSelectedEngine}
              onCompare={handleCompare}
            />
          </div>

          {/* A/B 비교 패널 */}
          {showABCompare && (
            <div className="bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-xl p-5">
              <ABCompare
                hqSvcSrc={hqSvcSrc}
                rvcSrc={rvcSrc}
                onPreferenceSelect={handlePreferenceSelect}
              />
            </div>
          )}

          <UsageCounter />
        </div>
      )}

      {/* RVC 경로 탭 */}
      {activeTab === 'rvc' && (
        <div className="flex flex-col gap-5">
          <StepIndicator currentStep={currentStep} />

          <div className="mt-2">
            {currentStep === 'record' && (
              <RecordStep userId={userId} onRecordingSaved={() => getTotalRecordingSec().then(setTotalRecordingSec)} />
            )}
            {currentStep === 'model' && <ModelStep />}
            {currentStep === 'convert' && <ConvertStep />}
            {currentStep === 'result' && <ResultStep />}
          </div>
        </div>
      )}
    </div>
  );
}
