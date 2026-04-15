import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { UserInventoryItem } from '@/types';

// GET: 현재 유저의 인벤토리 조회 (아이템 정보 join)
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
    .from('user_inventory')
    .select('*, item:shop_items(*)')
    .eq('user_id', user.id)
    .order('acquired_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: '인벤토리 조회 실패', code: 'DB_ERROR' },
      { status: 500 },
    );
  }

  return NextResponse.json((data ?? []) as UserInventoryItem[]);
}
