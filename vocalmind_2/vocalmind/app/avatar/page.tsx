import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AvatarClient from './AvatarClient';

export const metadata = {
  title: '내 아바타 | HLB 보컬스튜디오',
  description: '나만의 아바타를 꾸미고 의상을 코디해보세요.',
};

export default async function AvatarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?next=/avatar');
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        paddingTop: '80px',
        paddingBottom: '80px',
      }}
    >
      <AvatarClient />
    </main>
  );
}
