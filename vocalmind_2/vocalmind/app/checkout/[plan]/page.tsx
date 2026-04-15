import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
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

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: Array<{ name: string; value: string; options?: Record<string, unknown> }>) =>
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])),
      },
    },
  );

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
