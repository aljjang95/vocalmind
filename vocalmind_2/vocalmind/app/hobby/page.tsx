import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import HobbyClient from './HobbyClient';

export default async function HobbyPage() {
  const supabase = await createClient();

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
