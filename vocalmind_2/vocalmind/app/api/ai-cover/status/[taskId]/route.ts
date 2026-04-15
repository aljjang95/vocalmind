import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  const { taskId } = await params;

  const { data: conversion } = await supabase
    .from('ai_cover_conversions')
    .select('*')
    .eq('id', taskId)
    .eq('user_id', user.id)
    .single();

  if (!conversion) {
    return NextResponse.json({ error: '변환을 찾을 수 없습니다' }, { status: 404 });
  }

  return NextResponse.json(conversion);
}
