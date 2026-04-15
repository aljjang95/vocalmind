import type { Metadata } from 'next';
import DiagnosisPageClient from './DiagnosisPageClient';

export const metadata: Metadata = {
  title: '보컬 진단 — HLB 보컬스튜디오',
  description: 'AI가 분석하는 나만의 보컬 진단. 음정, 호흡, 성량, 음색, 테크닉을 종합 평가합니다.',
};

export default function DiagnosisPage() {
  return <DiagnosisPageClient />;
}
