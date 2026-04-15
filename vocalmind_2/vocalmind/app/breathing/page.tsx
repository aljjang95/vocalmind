import type { Metadata } from 'next';
import BreathingPageClient from './BreathingPageClient';

export const metadata: Metadata = {
  title: '호흡 트레이너 | HLB 보컬스튜디오',
  description:
    '롱 브레스, 리듬 브레스, 프레이즈 호흡 훈련으로 보컬 호흡 능력을 향상시키세요.',
};

export default function BreathingPage() {
  return <BreathingPageClient />;
}
