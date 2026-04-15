import { Metadata } from 'next';
import DashboardClient from './DashboardClient';

export const metadata: Metadata = {
  title: '대시보드 | HLB 보컬스튜디오',
  description: '보컬 트레이닝 진도와 성장을 확인하세요.',
};

export default function DashboardPage() {
  return <DashboardClient />;
}
