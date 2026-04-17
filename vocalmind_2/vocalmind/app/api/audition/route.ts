import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth, isAuthResult } from '@/lib/infra/auth';
import type { AuditionEvent, AuditionEntry } from '@/types';

// GET /api/audition — 현재 active 이벤트 조회
// GET /api/audition?entries=true — 이벤트 + 참가자 목록
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { searchParams } = new URL(request.url);
  const withEntries = searchParams.get('entries') === 'true';

  try {
    // active 이벤트 조회
    const { data: eventRow, error: eventError } = await supabase
      .from('audition_events')
      .select('id, song_title, song_artist, description, week_start, week_end, status, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (eventError) {
      return NextResponse.json(
        { error: '오디션 이벤트를 불러오지 못했습니다.', code: 'DB_ERROR' },
        { status: 500 },
      );
    }

    const event: AuditionEvent | null = eventRow ?? null;

    if (!withEntries || !event) {
      return NextResponse.json({ event });
    }

    // 참가자 목록 조회 (vote_count 내림차순)
    const { data: entryRows, error: entriesError } = await supabase
      .from('audition_entries')
      .select(`
        id, event_id, user_id, audio_url, vote_count, rank, created_at
      `)
      .eq('event_id', event.id)
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: true });

    if (entriesError) {
      return NextResponse.json(
        { error: '참가자 목록을 불러오지 못했습니다.', code: 'DB_ERROR' },
        { status: 500 },
      );
    }

    const rows = entryRows ?? [];

    // has_voted + myEntry 처리 (로그인 시)
    let votedEntryIds = new Set<string>();
    let myEntry: AuditionEntry | null = null;

    if (user && rows.length > 0) {
      const entryIds = rows.map((e) => e.id);
      const { data: votes } = await supabase
        .from('audition_votes')
        .select('entry_id')
        .eq('user_id', user.id)
        .in('entry_id', entryIds);
      if (votes) {
        votedEntryIds = new Set(votes.map((v) => v.entry_id));
      }
    }

    // 프로필 + 아바타 별도 조회 (FK가 auth.users → PostgREST 조인 불가)
    const entryUserIds = Array.from(new Set(rows.map((e) => e.user_id)));
    const profileMap = new Map<string, string>();
    const avatarMap = new Map<string, string>();
    if (entryUserIds.length > 0) {
      const [{ data: profileRows }, { data: avatarRows }] = await Promise.all([
        supabase.from('profiles').select('id, name').in('id', entryUserIds),
        supabase.from('avatars').select('user_id, base_image_url').in('user_id', entryUserIds),
      ]);
      if (profileRows) {
        for (const row of profileRows) profileMap.set(row.id, row.name);
      }
      if (avatarRows) {
        for (const row of avatarRows) avatarMap.set(row.user_id, row.base_image_url);
      }
    }

    const entries: AuditionEntry[] = rows.map((e) => {
      const entry: AuditionEntry = {
        id: e.id,
        event_id: e.event_id,
        user_id: e.user_id,
        audio_url: e.audio_url,
        vote_count: e.vote_count,
        rank: e.rank,
        created_at: e.created_at,
        author_name: profileMap.get(e.user_id) ?? '익명',
        author_avatar_url: avatarMap.get(e.user_id) ?? undefined,
        has_voted: votedEntryIds.has(e.id),
      };
      return entry;
    });

    // myEntry 찾기
    if (user) {
      myEntry = entries.find((e) => e.user_id === user.id) ?? null;
    }

    return NextResponse.json({ event, entries, myEntry });
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}

// POST /api/audition — 오디션 참가 (FormData)
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!isAuthResult(auth)) return auth;
  const { user, supabase } = auth;

  try {
    const formData = await request.formData();
    const audio = formData.get('audio') as File | null;
    const eventId = (formData.get('eventId') as string | null)?.trim();

    if (!audio) {
      return NextResponse.json(
        { error: '오디오 파일이 필요합니다.', code: 'NO_AUDIO' },
        { status: 400 },
      );
    }

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId가 필요합니다.', code: 'MISSING_FIELDS' },
        { status: 400 },
      );
    }

    // 이벤트 존재 + active 확인
    const { data: eventRow, error: eventError } = await supabase
      .from('audition_events')
      .select('id, status')
      .eq('id', eventId)
      .eq('status', 'active')
      .maybeSingle();

    if (eventError || !eventRow) {
      return NextResponse.json(
        { error: '유효하지 않은 오디션 이벤트입니다.', code: 'INVALID_EVENT' },
        { status: 400 },
      );
    }

    // 이미 참가 여부 확인
    const { data: existing } = await supabase
      .from('audition_entries')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: '이미 이번 오디션에 참가하셨습니다.', code: 'ALREADY_ENTERED' },
        { status: 409 },
      );
    }

    // Supabase Storage 오디오 업로드
    const audioBuffer = await audio.arrayBuffer();
    const storagePath = `${eventId}/${user.id}.webm`;

    const { error: storageError } = await supabase.storage
      .from('audition-audio')
      .upload(storagePath, audioBuffer, {
        contentType: 'audio/webm',
        upsert: true,
      });

    if (storageError) {
      return NextResponse.json(
        { error: '오디오 업로드에 실패했습니다.', code: 'STORAGE_ERROR' },
        { status: 500 },
      );
    }

    const { data: urlData } = supabase.storage
      .from('audition-audio')
      .getPublicUrl(storagePath);

    const audioUrl = urlData.publicUrl;

    // audition_entries insert
    const { data: entryRow, error: insertError } = await supabase
      .from('audition_entries')
      .insert({
        event_id: eventId,
        user_id: user.id,
        audio_url: audioUrl,
        vote_count: 0,
        rank: null,
      })
      .select('id, event_id, user_id, audio_url, vote_count, rank, created_at')
      .single();

    if (insertError || !entryRow) {
      return NextResponse.json(
        { error: '참가 등록에 실패했습니다.', code: 'DB_ERROR' },
        { status: 500 },
      );
    }

    // 프로필 정보 fetch
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single();

    const entry: AuditionEntry = {
      id: entryRow.id,
      event_id: entryRow.event_id,
      user_id: entryRow.user_id,
      audio_url: entryRow.audio_url,
      vote_count: entryRow.vote_count,
      rank: entryRow.rank,
      created_at: entryRow.created_at,
      author_name: profile?.name ?? '익명',
      author_avatar_url: undefined,
      has_voted: false,
    };

    return NextResponse.json({ entry }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
