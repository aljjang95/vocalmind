import type { Metadata } from 'next';
import PricingClient from './PricingClient';

export const metadata: Metadata = {
  title: '요금제 | HLB 보컬스튜디오',
  description: '오프라인 레슨 그대로, 온라인으로. 무료부터 발성전문반까지.',
};

export default function PricingPage() {
  return <PricingClient />;
}
