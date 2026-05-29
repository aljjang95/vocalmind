import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';

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
  // 1. 인증 먼저 — 토스 승인 전에 수행해야 비인증 결제 승인(승인은 성공/DB는 누락) 사고를 막는다.
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user, supabase } = auth;

  let paymentKey: unknown, orderId: unknown, amount: unknown;
  try {
    ({ paymentKey, orderId, amount } = await req.json());
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식', code: 'INVALID_JSON' }, { status: 400 });
  }

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
  }

  // 2. 금액 화이트리스트 검증 (토스 승인 전 — 클라 위변조 금액 차단)
  const plan = PLAN_BY_AMOUNT[amount as number];
  if (!plan) {
    return NextResponse.json({ error: '알 수 없는 결제 금액' }, { status: 400 });
  }

  // 3. 토스페이먼츠 승인 API
  const secretKey = process.env.TOSSPAYMENTS_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: '결제 설정 오류', code: 'CONFIG_ERROR' }, { status: 500 });
  }
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

  const expiresAt = getExpiresAt(plan);

  // 4. 결제 내역 저장 (멱등 — toss_order_id unique 제약 기반 23505 재처리)
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
    // unique 위반 → 이미 처리된 orderId. 재호출은 성공 취급 (멱등).
    if (paymentError.code === '23505') {
      return NextResponse.json({ success: true, plan, expiresAt, idempotent: true });
    }
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
