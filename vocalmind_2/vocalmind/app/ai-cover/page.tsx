import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AiCoverClient from './AiCoverClient';

export const metadata = {
  title: 'AI 커버 | HLB 보컬스튜디오',
  description: '내 목소리로 좋아하는 노래를 불러보세요',
};

export default async function AiCoverPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?next=/ai-cover');
  }

  return <AiCoverClient userId={user.id} />;
}
