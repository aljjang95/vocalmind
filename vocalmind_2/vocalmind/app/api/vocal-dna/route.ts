import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BACKEND_URL = process.env.VOCAL_BACKEND_URL ?? 'http://localhost:8001';

// GET: Supabase에서 현재 유저의 vocal_dna 조회
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: '로그인이 필요합니다', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  try {
    const { data, error } = await supabase
      .from('vocal_dna')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'DNA 데이터 없음', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: '데이터 조회 실패', code: 'DB_ERROR' },
      { status: 500 },
    );
  }
}

// POST: audio FormData → Python /vocal-dna/analyze 프록시 → 결과 Supabase 저장
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { error: '로그인이 필요합니다', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const audio = formData.get('audio') as File | null;

    if (!audio) {
      return NextResponse.json(
        { error: '오디오 파일이 필요합니다', code: 'MISSING_AUDIO' },
        { status: 400 },
      );
    }

    // Python 백엔드에 분석 요청
    const backendForm = new FormData();
    backendForm.append('audio', audio, audio.name || 'recording.webm');

    const resp = await fetch(`${BACKEND_URL}/vocal-dna/analyze`, {
      method: 'POST',
      body: backendForm,
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({})) as { error?: string };
      return NextResponse.json(
        { error: errBody.error ?? '분석 서버 오류', code: 'BACKEND_ERROR' },
        { status: resp.status },
      );
    }

    const analysisResult = await resp.json() as {
      laryngeal: number;
      tongue_root: number;
      jaw: number;
      register_break: number;
      tone_stability: number;
      avg_pitch_hz: number | null;
      voice_type: string | null;
    };

    // Supabase vocal_dna 테이블에 upsert
    const { data: saved, error: dbError } = await supabase
      .from('vocal_dna')
      .upsert(
        {
          user_id: user.id,
          laryngeal: analysisResult.laryngeal,
          tongue_root: analysisResult.tongue_root,
          jaw: analysisResult.jaw,
          register_break: analysisResult.register_break,
          tone_stability: analysisResult.tone_stability,
          avg_pitch_hz: analysisResult.avg_pitch_hz ?? null,
          voice_type: analysisResult.voice_type ?? null,
          source: 'manual_recording',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select()
      .single();

    if (dbError || !saved) {
      return NextResponse.json(
        { error: 'DNA 저장 실패', code: 'DB_ERROR' },
        { status: 500 },
      );
    }

    return NextResponse.json(saved);
  } catch {
    return NextResponse.json(
      { error: '분석 서버 연결 실패', code: 'BACKEND_ERROR' },
      { status: 502 },
    );
  }
}
