'use client';

import { useCallback } from 'react';
import { getCurrentStage, getRecommendedEngine } from '@/lib/data/growthStages';
import styles from './EngineSelector.module.css';

export type SelectedEngine = 'hq_svc' | 'rvc';

interface EngineSelectorProps {
  totalRecordingSec: number;
  selectedEngine: SelectedEngine;
  onSelectEngine: (engine: SelectedEngine) => void;
  onCompare?: () => void;
}

export default function EngineSelector({
  totalRecordingSec,
  selectedEngine,
  onSelectEngine,
  onCompare,
}: EngineSelectorProps) {
  const currentStage = getCurrentStage(totalRecordingSec);
  const recommendedMode = getRecommendedEngine(totalRecordingSec);

  const canUseHqSvc = true; // 항상 가능
  const canUseRvc = totalRecordingSec >= 80; // 80초 이상 녹음 시
  const canCompare = recommendedMode === 'both' || (canUseHqSvc && canUseRvc);

  const handleSelect = useCallback(
    (engine: SelectedEngine) => {
      onSelectEngine(engine);
    },
    [onSelectEngine],
  );

  return (
    <div className={styles.wrap}>
      <p className={styles.title}>변환 엔진</p>

      <div className={styles.btnRow}>
        {/* HQ-SVC 버튼 */}
        <button
          type="button"
          className={`${styles.engineBtn} ${selectedEngine === 'hq_svc' ? styles.selected : ''}`}
          onClick={() => handleSelect('hq_svc')}
          disabled={!canUseHqSvc}
        >
          {(recommendedMode === 'hq_svc' || (recommendedMode !== 'rvc' && totalRecordingSec < 300)) && (
            <span className={styles.badge}>추천</span>
          )}
          <span className={styles.engineName}>HQ-SVC</span>
          <span className={styles.engineDesc}>즉시 변환 · 녹음 불필요</span>
        </button>

        {/* RVC 버튼 */}
        <button
          type="button"
          className={`${styles.engineBtn} ${selectedEngine === 'rvc' ? styles.selected : ''}`}
          onClick={() => handleSelect('rvc')}
          disabled={!canUseRvc}
        >
          {recommendedMode === 'rvc' && (
            <span className={styles.badge}>추천</span>
          )}
          <span className={styles.engineName}>RVC 학습 모델</span>
          <span className={styles.engineDesc}>
            {canUseRvc ? '내 목소리 맞춤 모델' : '80초 녹음 후 해금'}
          </span>
        </button>
      </div>

      {!canUseRvc && (
        <p className={styles.lockedMsg}>
          RVC는 {currentStage.name} 단계에서 해금됩니다 (현재{' '}
          {Math.floor(totalRecordingSec / 60)}분 {totalRecordingSec % 60}초 / 1분 20초 필요)
        </p>
      )}

      {canCompare && onCompare && (
        <button type="button" className={styles.compareBtn} onClick={onCompare}>
          HQ-SVC vs RVC 비교하기
        </button>
      )}
    </div>
  );
}
