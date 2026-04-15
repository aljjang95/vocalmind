import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CommunityClient from './CommunityClient';

export const metadata: Metadata = {
  title: '커뮤니티 | HLB 보컬스튜디오',
  description: '보컬 커버를 공유하고 서로 응원해요.',
};

export default async function CommunityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?next=/community');

  return <CommunityClient />;
}
