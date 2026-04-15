import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
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
    return NextResponse.json({ plan: 'free' });
  }

  const { data } = await supabase
    .from('vocal_user_plans')
    .select('plan, expires_at')
    .eq('user_id', user.id)
    .single();

  if (!data) {
    return NextResponse.json({ plan: 'free' });
  }

  // 만료 체크
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    await supabase
      .from('vocal_user_plans')
      .update({ plan: 'free', expires_at: null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);
    return NextResponse.json({ plan: 'free' });
  }

  return NextResponse.json({ plan: data.plan, expiresAt: data.expires_at });
}
