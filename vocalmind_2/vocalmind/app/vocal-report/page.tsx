import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import VocalReportClient from '../ai-cover/VocalReportClient';

export const metadata = {
  title: '발성 분석 리포트 | HLB 보컬스튜디오',
  description: '지금 내 목소리 긴장 상태를 4축으로 분석합니다',
};

export default async function VocalReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?next=/vocal-report');
  }

  return <VocalReportClient />;
}
