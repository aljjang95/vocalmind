import { NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';

export async function GET() {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) {
    // 미로그인 시 free 플랜 반환 (401 대신)
    return NextResponse.json({ plan: 'free' });
  }
  const { user, supabase } = auth;

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
