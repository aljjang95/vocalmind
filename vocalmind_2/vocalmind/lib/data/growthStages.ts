/**
 * 아바타 성장 단계 — 녹음량 기반
 *
 * 음성변환 프로젝트 RVC 학습 실측 데이터 기반:
 * - 80초: loss 10.01, 체감 ~70%
 * - 5분: ~80%
 * - 10분: ~88%
 * - 30분: ~93%
 * - 1시간+: ~95%
 */

export interface GrowthStage {
  id: number;
  name: string;
  minRecordingSec: number;
  engine: 'hq_svc' | 'rvc' | 'both';
  estimatedQuality: number; // 0~100
  avatarLevel: string;
  description: string;
  unlocks: string[];
}

export const GROWTH_STAGES: GrowthStage[] = [
  {
    id: 1,
    name: '첫 만남',
    minRecordingSec: 10,
    engine: 'hq_svc',
    estimatedQuality: 60,
    avatarLevel: '기본',
    description: '10초 녹음으로 빠른 변환 체험',
    unlocks: ['HQ-SVC 체험 변환 3곡/일'],
  },
  {
    id: 2,
    name: '성장 중',
    minRecordingSec: 80,
    engine: 'both', // A/B 비교 제공
    estimatedQuality: 70,
    avatarLevel: '초급',
    description: '학습 모델 생성 가능! HQ-SVC와 비교해보세요',
    unlocks: ['RVC 학습 모델 생성', 'A/B 비교 듣기'],
  },
  {
    id: 3,
    name: '각성',
    minRecordingSec: 300, // 5분
    engine: 'both',
    estimatedQuality: 80,
    avatarLevel: '중급',
    description: 'RVC 품질이 확실히 향상됩니다',
    unlocks: ['고품질 변환', '발라드/팝 프리셋'],
  },
  {
    id: 4,
    name: '완성',
    minRecordingSec: 600, // 10분
    engine: 'rvc',
    estimatedQuality: 88,
    avatarLevel: '고급',
    description: 'RVC가 최고 품질에 도달합니다',
    unlocks: ['HD 변환', '후처리 커스텀'],
  },
  {
    id: 5,
    name: '마스터',
    minRecordingSec: 1800, // 30분
    engine: 'rvc',
    estimatedQuality: 93,
    avatarLevel: '마스터',
    description: '거의 완벽한 음색 복제',
    unlocks: ['커뮤니티 자동 게시', '아바타 최종 형태'],
  },
];

/**
 * 현재 녹음량으로 성장 단계 결정
 */
export function getCurrentStage(totalRecordingSec: number): GrowthStage {
  let current = GROWTH_STAGES[0];
  for (const stage of GROWTH_STAGES) {
    if (totalRecordingSec >= stage.minRecordingSec) {
      current = stage;
    }
  }
  return current;
}

/**
 * 다음 단계까지 남은 녹음량
 */
export function getNextStageProgress(totalRecordingSec: number): {
  currentStage: GrowthStage;
  nextStage: GrowthStage | null;
  progressPercent: number;
  remainingSec: number;
} {
  const currentStage = getCurrentStage(totalRecordingSec);
  const currentIdx = GROWTH_STAGES.indexOf(currentStage);
  const nextStage = currentIdx < GROWTH_STAGES.length - 1 ? GROWTH_STAGES[currentIdx + 1] : null;

  if (!nextStage) {
    return { currentStage, nextStage: null, progressPercent: 100, remainingSec: 0 };
  }

  const rangeStart = currentStage.minRecordingSec;
  const rangeEnd = nextStage.minRecordingSec;
  const progress = Math.min(1, (totalRecordingSec - rangeStart) / (rangeEnd - rangeStart));

  return {
    currentStage,
    nextStage,
    progressPercent: Math.round(progress * 100),
    remainingSec: Math.max(0, rangeEnd - totalRecordingSec),
  };
}

/**
 * 품질 게이트: 추천 엔진 결정
 * - 5분 미만: HQ-SVC 유지 (RVC는 A/B 비교용)
 * - 5분 이상: RVC 추천 (HQ-SVC도 선택 가능)
 */
export function getRecommendedEngine(totalRecordingSec: number): 'hq_svc' | 'rvc' | 'both' {
  if (totalRecordingSec < 80) return 'hq_svc';
  if (totalRecordingSec < 300) return 'both'; // A/B 비교
  return 'rvc';
}
