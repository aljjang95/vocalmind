import type { Metadata } from 'next';
import WarmupPageClient from './WarmupPageClient';

export const metadata: Metadata = {
  title: 'AI 워밍업 | HLB 보컬스튜디오',
  description: 'AI가 오늘의 컨디션에 맞춰 생성하는 맞춤 워밍업 루틴으로 보컬 트레이닝을 시작하세요.',
};

export default function WarmupPage() {
  return <WarmupPageClient />;
}
