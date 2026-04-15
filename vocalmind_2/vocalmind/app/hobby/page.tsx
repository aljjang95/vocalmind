import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import HobbyClient from './HobbyClient';

export default async function HobbyPage() {
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
    redirect('/auth/login?next=/hobby');
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)]">
      <HobbyClient />
    </main>
  );
}
