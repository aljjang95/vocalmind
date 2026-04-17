import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CheckoutClient from './CheckoutClient';

interface Props {
  params: Promise<{ plan: string }>;
}

const VALID_PLANS = ['hobby', 'pro', 'feedback'];

export default async function CheckoutPage({ params }: Props) {
  const { plan } = await params;

  if (!VALID_PLANS.includes(plan)) {
    redirect('/pricing');
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/login?next=/checkout/${plan}`);
  }

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingTop: '5rem' }}>
      <CheckoutClient
        plan={plan}
        userEmail={user.email ?? ''}
        userName={user.user_metadata?.name ?? user.email ?? ''}
      />
    </main>
  );
}
