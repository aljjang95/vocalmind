import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import VocalDnaClient from './VocalDnaClient';

export const metadata = {
  title: '음색 DNA | HLB 보컬스튜디오',
  description: '나만의 음색 DNA 별자리를 확인하고 공유하세요.',
};

export default async function VocalDnaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?next=/vocal-dna');
  }

  // 초기 데이터: 프로필 이름 조회 (없으면 null)
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, full_name')
    .eq('id', user.id)
    .single();

  const userName =
    profile?.display_name ??
    profile?.full_name ??
    user.email?.split('@')[0] ??
    '보컬리스트';

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        paddingTop: '80px',
        paddingBottom: '80px',
      }}
    >
      <VocalDnaClient userName={userName} />
    </main>
  );
}
