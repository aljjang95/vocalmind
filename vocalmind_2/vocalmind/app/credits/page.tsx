import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CreditsClient from './CreditsClient';

export const metadata: Metadata = {
  title: '크레딧 충전 — 보컬마인드',
};

export default async function CreditsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirect=/credits');

  const { data: balanceRow } = await supabase
    .from('studio_credit_balances')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <CreditsClient
      userEmail={user.email ?? ''}
      userName={(user.user_metadata?.full_name as string) ?? user.email ?? '사용자'}
      initialBalance={balanceRow?.balance ?? 0}
    />
  );
}
