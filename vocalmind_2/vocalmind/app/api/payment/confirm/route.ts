import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const PLAN_BY_AMOUNT: Record<number, 'hobby' | 'pro' | 'feedback'> = {
  100000: 'hobby',
  150000: 'pro',
  50000: 'feedback',
};

function getExpiresAt(plan: string): Date | null {
  if (plan === 'feedback') return null;
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
}

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount } = await req.json();

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  // 1. 토스페이먼츠 승인 API
  const secretKey = process.env.TOSSPAYMENTS_SECRET_KEY!;
  const encoded = Buffer.from(`${secretKey}:`).toString('base64');

  const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  const tossData = await tossRes.json();

  if (!tossRes.ok) {
    return NextResponse.json(
      { error: tossData.message || '결제 승인 실패', code: tossData.code },
      { status: 400 },
    );
  }

  // 2. Supabase — 유저 확인
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

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 });
  }

  const plan = PLAN_BY_AMOUNT[amount];
  if (!plan) {
    return NextResponse.json({ error: '알 수 없는 결제 금액' }, { status: 400 });
  }

  const expiresAt = getExpiresAt(plan);

  // 3. 결제 내역 저장
  const { error: paymentError } = await supabase.from('vocal_payments').insert({
    user_id: user.id,
    plan,
    amount,
    toss_payment_key: paymentKey,
    toss_order_id: orderId,
    status: 'completed',
    expires_at: expiresAt,
  });

  if (paymentError) {
    console.error('Payment insert error:', paymentError);
    return NextResponse.json({ error: 'DB 저장 실패' }, { status: 500 });
  }

  // 4. 플랜 업데이트 (feedback은 플랜 변경 없음)
  if (plan !== 'feedback') {
    await supabase.from('vocal_user_plans').upsert(
      { user_id: user.id, plan, expires_at: expiresAt, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  }

  return NextResponse.json({ success: true, plan, expiresAt });
}
