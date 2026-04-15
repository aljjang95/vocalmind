// ─────────────────────────────────────────────
// HLB 보컬스튜디오 — 7카테고리 x 4레슨 정적 커리큘럼
// ─────────────────────────────────────────────

import { CurriculumCategory } from '@/types';

export const CURRICULUM: CurriculumCategory[] = [
  {
    id: 'breathing',
    title: '호흡 & 발성 기초',
    icon: '🌬️',
    description: '복식호흡부터 성대 안정화까지 탄탄한 기반을 다집니다.',
    lessons: [
      { id: 'breathing-1', title: '복식호흡 원리와 실습', description: '횡격막을 활용한 올바른 호흡법을 익힙니다.', durationMin: 15 },
      { id: 'breathing-2', title: '호흡 지지점 찾기', description: '배꼽 아래 지지점을 확인하고 안정적 호흡을 유지합니다.', durationMin: 15 },
      { id: 'breathing-3', title: '프레이즈 호흡 연습', description: '긴 프레이즈를 한 호흡에 소화하는 연습을 합니다.', durationMin: 20 },
      { id: 'breathing-4', title: '발성과 호흡 연결', description: '호흡을 소리로 자연스럽게 전환하는 방법을 학습합니다.', durationMin: 20 },
    ],
  },
  {
    id: 'pitch',
    title: '음정 & 음감 훈련',
    icon: '🎯',
    description: '정확한 음정과 안정적인 음감 능력을 기릅니다.',
    lessons: [
      { id: 'pitch-1', title: '스케일 음정 훈련', description: '도레미파솔라시도 기본 스케일을 정확히 부릅니다.', durationMin: 15 },
      { id: 'pitch-2', title: '인터벌 트레이닝', description: '2도~8도 음정 간격을 듣고 재현하는 연습입니다.', durationMin: 20 },
      { id: 'pitch-3', title: '실전 곡 음정 교정', description: '실제 노래에서 자주 틀리는 구간을 교정합니다.', durationMin: 20 },
      { id: 'pitch-4', title: '상대음감 심화', description: '기준음 없이 음정 관계를 파악하는 훈련입니다.', durationMin: 25 },
    ],
  },
  {
    id: 'high-notes',
    title: '고음 & 믹스보이스',
    icon: '🚀',
    description: '무리 없이 고음을 내는 믹스보이스 테크닉을 습득합니다.',
    lessons: [
      { id: 'high-1', title: '흉성-두성 전환점 이해', description: '브레이크 포인트를 파악하고 전환 연습을 합니다.', durationMin: 20 },
      { id: 'high-2', title: '믹스보이스 기초', description: '흉성과 두성을 섞어 자연스러운 고음을 냅니다.', durationMin: 20 },
      { id: 'high-3', title: '고음 지지력 강화', description: '복압과 호흡을 활용한 안정적인 고음 유지법입니다.', durationMin: 25 },
      { id: 'high-4', title: '벨팅 & 파워 고음', description: '성대에 무리 없이 파워풀한 고음을 구사합니다.', durationMin: 25 },
    ],
  },
  {
    id: 'tone',
    title: '음색 & 공명',
    icon: '✨',
    description: '자신만의 음색을 찾고 공명을 최적화합니다.',
    lessons: [
      { id: 'tone-1', title: '구강 공명 이해', description: '입 안 공간을 활용해 풍부한 소리를 만듭니다.', durationMin: 15 },
      { id: 'tone-2', title: '비강 공명 조절', description: '비성을 적절히 활용해 음색에 색채를 더합니다.', durationMin: 15 },
      { id: 'tone-3', title: '흉부 공명 연습', description: '저음에서 중음까지 따뜻한 울림을 만듭니다.', durationMin: 20 },
      { id: 'tone-4', title: '나만의 음색 찾기', description: '장르에 맞는 자신만의 톤을 개발합니다.', durationMin: 20 },
    ],
  },
  {
    id: 'technique',
    title: '보컬 테크닉',
    icon: '🎶',
    description: '비브라토, 팔세토 등 다양한 기법을 마스터합니다.',
    lessons: [
      { id: 'tech-1', title: '비브라토 기초', description: '횡격막 비브라토를 자연스럽게 구사합니다.', durationMin: 20 },
      { id: 'tech-2', title: '팔세토 & 브레시 톤', description: '가성과 브레시 톤을 효과적으로 활용합니다.', durationMin: 20 },
      { id: 'tech-3', title: '런 & 리프 연습', description: '빠른 음 이동과 장식음을 깔끔하게 부릅니다.', durationMin: 25 },
      { id: 'tech-4', title: '다이나믹 표현력', description: '강약 조절로 곡의 감정 전달력을 높입니다.', durationMin: 25 },
    ],
  },
  {
    id: 'diction',
    title: '발음 & 딕션',
    icon: '💬',
    description: '명확한 발음과 가사 전달력을 키웁니다.',
    lessons: [
      { id: 'dict-1', title: '한국어 모음 명료도', description: '아에이오우 모음을 또렷하게 발음합니다.', durationMin: 15 },
      { id: 'dict-2', title: '자음 & 받침 처리', description: '노래 중 자음과 받침을 자연스럽게 처리합니다.', durationMin: 15 },
      { id: 'dict-3', title: '영어 발음 교정', description: '영어 가사의 발음과 연음을 매끄럽게 합니다.', durationMin: 20 },
      { id: 'dict-4', title: '가사 전달력 향상', description: '감정을 담아 가사를 전달하는 기법입니다.', durationMin: 20 },
    ],
  },
  {
    id: 'performance',
    title: '실전 & 무대',
    icon: '🎤',
    description: '오디션과 무대에서 실력을 발휘하는 방법을 배웁니다.',
    lessons: [
      { id: 'perf-1', title: '곡 선정 & 키 설정', description: '본인에게 맞는 곡과 키를 찾는 전략입니다.', durationMin: 15 },
      { id: 'perf-2', title: '무대 긴장 관리', description: '공연 전 루틴과 멘탈 관리 기법을 익힙니다.', durationMin: 15 },
      { id: 'perf-3', title: '마이크 테크닉', description: '마이크 거리와 각도를 활용한 소리 조절법입니다.', durationMin: 20 },
      { id: 'perf-4', title: '연습 루틴 설계', description: '매일/매주 효율적인 연습 계획을 세웁니다.', durationMin: 20 },
    ],
  },
];

export function getCategoryById(id: string): CurriculumCategory | undefined {
  return CURRICULUM.find((c) => c.id === id);
}

export function getLessonById(lessonId: string): { category: CurriculumCategory; lesson: CurriculumCategory['lessons'][number] } | undefined {
  for (const cat of CURRICULUM) {
    const lesson = cat.lessons.find((l) => l.id === lessonId);
    if (lesson) return { category: cat, lesson };
  }
  return undefined;
}
