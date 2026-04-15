import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ItemCategory, UserEquipped } from '@/types';

const CATEGORY_COLUMN: Record<ItemCategory, keyof Omit<UserEquipped, 'user_id' | 'updated_at'>> = {
  hat: 'hat_id',
  top: 'top_id',
  bottom: 'bottom_id',
  accessory: 'accessory_id',
  effect: 'effect_id',
  crown: 'hat_id', // 왕관은 hat 슬롯 사용
};

// GET: 현재 유저의 장착 상태 조회
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: '로그인이 필요합니다', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from('user_equipped')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: '장착 정보 없음', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  return NextResponse.json(data as UserEquipped);
}

// POST: 아이템 장착 / 해제
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
    category?: ItemCategory;
    itemId?: string | null;
  } | null;

  if (!body || !body.category) {
    return NextResponse.json(
      { error: '필수 파라미터 누락 (category)', code: 'INVALID_REQUEST' },
      { status: 400 },
    );
  }

  const { category, itemId } = body;

  // itemId가 있으면 인벤토리 소유 확인
  if (itemId) {
    const { data: inventoryItem } = await supabase
      .from('user_inventory')
      .select('id')
      .eq('user_id', user.id)
      .eq('item_id', itemId)
      .single();

    if (!inventoryItem) {
      return NextResponse.json(
        { error: '인벤토리에 없는 아이템입니다', code: 'ITEM_NOT_OWNED' },
        { status: 403 },
      );
    }
  }

  const column = CATEGORY_COLUMN[category];

  // user_equipped upsert
  const { data: equipped, error: upsertError } = await supabase
    .from('user_equipped')
    .upsert(
      {
        user_id: user.id,
        [column]: itemId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single();

  if (upsertError || !equipped) {
    return NextResponse.json(
      { error: '장착 저장 실패', code: 'DB_ERROR' },
      { status: 500 },
    );
  }

  return NextResponse.json(equipped as UserEquipped);
}
