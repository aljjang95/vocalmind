import { NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';

/**
 * GET /api/credits/balance
 *
 * studio_credit_balances 뷰에서 현재 잔액을 조회한다.
 * 유저가 원장에 한 건도 없으면 0 반환.
 */
export async function GET() {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;

  const { user, supabase } = auth;

  const { data, error } = await supabase
    .from('studio_credit_balances')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: '잔액 조회 실패', code: 'QUERY_ERROR' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    balance: data?.balance ?? 0,
  });
}
