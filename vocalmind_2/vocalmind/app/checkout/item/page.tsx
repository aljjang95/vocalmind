import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ItemCheckoutClient from './ItemCheckoutClient';

export const metadata = { title: '아이템 결제 | HLB 보컬스튜디오' };

interface Props {
  searchParams: Promise<{ id?: string }>;
}

export default async function ItemCheckoutPage({ searchParams }: Props) {
  const { id } = await searchParams;
  if (!id) redirect('/avatar');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=/checkout/item?id=${id}`);

  const { data: item } = await supabase
    .from('shop_items')
    .select('*')
    .eq('id', id)
    .single();

  if (!item || item.price === 0 || item.is_reward_only) redirect('/avatar');

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingTop: '5rem' }}>
      <ItemCheckoutClient
        item={item}
        userEmail={user.email ?? ''}
        userName={user.user_metadata?.name ?? user.email ?? ''}
      />
    </main>
  );
}
