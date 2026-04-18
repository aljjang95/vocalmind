import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import VoiceIdentityClient from './VoiceIdentityClient';

export const metadata: Metadata = {
  title: '음색 등록 — 보컬마인드 스튜디오',
};

export default async function VoiceIdentityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login?redirect=/studio/voice-identity');

  // 기존 voice identity 상태 조회 (있으면 재등록 흐름)
  const { data: existing } = await supabase
    .from('voice_identities')
    .select('id, status, source_clip_count, ready_at')
    .eq('user_id', user.id)
    .in('status', ['collecting', 'training', 'ready'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <VoiceIdentityClient
      existingStatus={existing?.status ?? null}
      existingCount={existing?.source_clip_count ?? 0}
      existingId={existing?.id ?? null}
    />
  );
}
