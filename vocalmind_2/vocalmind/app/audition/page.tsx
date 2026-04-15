import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AuditionClient from './AuditionClient';

export const metadata: Metadata = {
  title: '주간 오디션 | HLB 보컬스튜디오',
  description: '이번 주 오디션에 참가하고 투표해보세요.',
};

export default async function AuditionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/audition');

  return (
    <main>
      <AuditionClient />
    </main>
  );
}
