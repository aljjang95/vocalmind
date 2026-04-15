import type { Metadata } from 'next';
import OnboardingClient from './OnboardingClient';

export const metadata: Metadata = {
  title: '상담 | HLB 보컬스튜디오',
  description: 'AI가 목소리를 분석하고 맞춤 레슨 로드맵을 제시합니다.',
};

export default function OnboardingPage() {
  return <OnboardingClient />;
}
