import type { Metadata } from 'next';
import PracticePageClient from './PracticePageClient';

export const metadata: Metadata = {
  title: '곡 연습 | HLB 보컬스튜디오',
  description: 'MR 재생, 보컬 가이드, 구간 반복, 실시간 음정 모니터링으로 효과적인 보컬 연습을 시작하세요.',
};

export default function PracticePage() {
  return <PracticePageClient />;
}
