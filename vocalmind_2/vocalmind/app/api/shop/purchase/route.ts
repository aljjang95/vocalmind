import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ShopItem } from '@/types';

// POST: 아이템 구매 처리
// 1) 가격 검증 (클라이언트 조작 방지)
// 2) 토스페이먼츠 승인
// 3) 구매 내역 + 인벤토리 저장
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: '로그인이 필요합니다', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null) as {
    itemId?: string;
    paymentKey?: string;
    orderId?: string;
    amount?: number;
  } | null;

  if (!body || !body.itemId || !body.paymentKey || !body.orderId || body.amount == null) {
    return NextResponse.json(
      { error: '필수 파라미터 누락', code: 'INVALID_REQUEST' },
      { status: 400 },
    );
  }

  const { itemId, paymentKey, orderId, amount } = body;

  // 1) 아이템 존재 및 가격 확인
  const { data: item, error: itemError } = await supabase
    .from('shop_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (itemError || !item) {
    return NextResponse.json(
      { error: '존재하지 않는 아이템입니다', code: 'ITEM_NOT_FOUND' },
      { status: 404 },
    );
  }

  const shopItem = item as ShopItem;

  // 보상 전용 아이템은 구매 불가
  if (shopItem.is_reward_only) {
    return NextResponse.json(
      { error: '보상 전용 아이템은 구매할 수 없습니다', code: 'REWARD_ONLY' },
      { status: 403 },
    );
  }

  // 금액 검증 (클라이언트 조작 방지)
  if (shopItem.price !== amount) {
    return NextResponse.json(
      { error: '결제 금액이 일치하지 않습니다', code: 'AMOUNT_MISMATCH' },
      { status: 400 },
    );
  }

  // 이미 보유 중인지 확인
  const { data: existingItem } = await supabase
    .from('user_inventory')
    .select('id')
    .eq('user_id', user.id)
    .eq('item_id', itemId)
    .single();

  if (existingItem) {
    return NextResponse.json(
      { error: '이미 보유한 아이템입니다', code: 'DUPLICATE_ITEM' },
      { status: 409 },
    );
  }

  // 2) 토스페이먼츠 승인 API 호출
  const secretKey = process.env.TOSS_PAYMENTS_SECRET_KEY ?? process.env.TOSSPAYMENTS_SECRET_KEY!;
  const encoded = Buffer.from(`${secretKey}:`).toString('base64');

  const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  const tossData = await tossRes.json() as { message?: string; code?: string };

  if (!tossRes.ok) {
    return NextResponse.json(
      { error: tossData.message ?? '결제 승인 실패', code: tossData.code ?? 'PAYMENT_FAILED' },
      { status: 400 },
    );
  }

  // 3) 구매 내역 저장
  const { error: purchaseError } = await supabase.from('item_purchases').insert({
    user_id: user.id,
    item_id: itemId,
    amount,
    toss_payment_key: paymentKey,
    toss_order_id: orderId,
    status: 'completed',
  });

  if (purchaseError) {
    return NextResponse.json(
      { error: '구매 내역 저장 실패', code: 'DB_ERROR' },
      { status: 500 },
    );
  }

  // 4) 인벤토리 추가
  const { error: inventoryError } = await supabase.from('user_inventory').insert({
    user_id: user.id,
    item_id: itemId,
    acquired_at: new Date().toISOString(),
    source: 'purchase',
  });

  if (inventoryError) {
    return NextResponse.json(
      { error: '인벤토리 저장 실패', code: 'DB_ERROR' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, itemId });
}
