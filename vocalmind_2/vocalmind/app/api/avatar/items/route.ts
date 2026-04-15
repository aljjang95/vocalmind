import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ShopItem } from '@/types';

// GET: 상점 아이템 목록 조회 (시즌 만료 제외)
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: '로그인이 필요합니다', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  const now = new Date().toISOString();

  // 시즌 만료된 아이템 제외: season_end_at이 null이거나 현재 시각 이후인 것만
  const { data, error } = await supabase
    .from('shop_items')
    .select('*')
    .or(`season_end_at.is.null,season_end_at.gt.${now}`)
    .order('category', { ascending: true })
    .order('price', { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: '아이템 조회 실패', code: 'DB_ERROR' },
      { status: 500 },
    );
  }

  return NextResponse.json((data ?? []) as ShopItem[]);
}
