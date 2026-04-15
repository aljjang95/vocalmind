import type { Metadata } from 'next';
import CoachPageClient from './CoachPageClient';

export const metadata: Metadata = {
  title: 'AI 보컬 코치 | HLB 보컬스튜디오',
  description: 'HLB 50단계 커리큘럼 기반 AI 보컬 코치. 실시간 피치 분석과 맞춤 피드백으로 보컬 실력을 키워보세요.',
};

export default function CoachPage() {
  return <CoachPageClient />;
}
