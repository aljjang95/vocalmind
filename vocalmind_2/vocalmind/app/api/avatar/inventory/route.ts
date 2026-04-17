import { NextResponse } from 'next/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';
import type { UserInventoryItem } from '@/types';

// GET: 현재 유저의 인벤토리 조회 (아이템 정보 join)
export async function GET() {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user, supabase } = auth;

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
