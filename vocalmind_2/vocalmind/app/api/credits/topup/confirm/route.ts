import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';
import { findCreditPack } from '@/types/credits';

interface ConfirmBody {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user, supabase } = auth;

  let body: ConfirmBody;
  try {
    body = (await req.json()) as ConfirmBody;
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식', code: 'INVALID_JSON' }, { status: 400 });
  }

  const { paymentKey, orderId, amount } = body;
  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json({ error: '필수 파라미터 누락', code: 'MISSING_PARAMS' }, { status: 400 });
  }

  const pack = findCreditPack(amount);
  if (!pack) {
    return NextResponse.json(
      { error: '알 수 없는 크레딧 팩 금액', code: 'UNKNOWN_PACK' },
      { status: 400 },
    );
  }

  // 1) 토스 결제 승인
  const secretKey = process.env.TOSSPAYMENTS_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json(
      { error: '결제 설정 오류', code: 'CONFIG_ERROR' },
      { status: 500 },
    );
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
      { error: tossData.message ?? '결제 승인 실패', code: tossData.code ?? 'TOSS_ERROR' },
      { status: 400 },
    );
  }

  // 2) 결제 내역 기록 (idempotency — orderId unique)
  const { data: payment, error: payErr } = await supabase
    .from('vocal_payments')
    .insert({
      user_id: user.id,
      plan: 'credits',
      amount,
      toss_payment_key: paymentKey,
      toss_order_id: orderId,
      status: 'completed',
      expires_at: null,
    })
    .select('id')
    .single();

  if (payErr || !payment) {
    // unique 위반 → 이미 처리된 orderId. 재호출은 성공 취급 (멱등).
    if (payErr?.code === '23505') {
      return NextResponse.json({ ok: true, credits: pack.credits, idempotent: true });
    }
    return NextResponse.json(
      { error: '결제 기록 실패', code: 'PAYMENT_INSERT_ERROR', detail: payErr?.message },
      { status: 500 },
    );
  }

  // 3) 크레딧 지급 (service role — grant_credits RPC는 revoke all로 user 호출 차단)
  const service = serviceClient();
  const { error: grantErr } = await service.rpc('grant_credits', {
    p_user_id: user.id,
    p_amount: pack.credits,
    p_reason: 'topup_purchase',
    p_job_id: null,
    p_payment_id: payment.id,
    p_metadata: { pack_label: pack.label, amount_krw: amount },
  });

  if (grantErr) {
    // 결제는 성공했지만 크레딧 지급 실패 → vocal_payments.status를 'grant_failed'로 마킹
    // 관리자가 payment_id로 추적 후 수동 or 배치 재지급 가능
    const { error: markErr } = await supabase
      .from('vocal_payments')
      .update({ status: 'grant_failed' })
      .eq('id', payment.id);

    if (markErr) {
      console.error(
        '[CRITICAL] grant_credits 실패 + vocal_payments 마킹도 실패 — payment_id=%s toss_order_id=%s grantErr=%o markErr=%o',
        payment.id,
        orderId,
        grantErr,
        markErr,
      );
    } else {
      console.error(
        '[CRITICAL] grant_credits 실패 (status=grant_failed 마킹 완료) — payment_id=%s toss_order_id=%s amount_krw=%d credits=%d grantErr=%o',
        payment.id,
        orderId,
        amount,
        pack.credits,
        grantErr,
      );
    }

    return NextResponse.json(
      {
        error: '크레딧 지급 실패 — 관리자에게 문의하세요',
        code: 'GRANT_ERROR',
        payment_id: payment.id,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, credits: pack.credits, label: pack.label });
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
