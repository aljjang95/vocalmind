import { NextRequest, NextResponse } from 'next/server';
import { anthropic } from '@/lib/anthropic';
import { createClient } from '@/lib/supabase/server';

const AI_MODEL = process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001';

/**
 * POST /api/report
 * 사용자의 연습 데이터를 기반으로 AI 성장 리포트를 생성한다.
 * body: { sessions: Array<{ date, score, tension, pitchAccuracy }>, period: "weekly" | "daily" }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      sessions?: Array<{ date: string; score: number; tension: number; pitchAccuracy: number }>;
      period?: string;
    };

    const sessions = body.sessions ?? [];
    const period = body.period ?? 'weekly';

    if (sessions.length === 0) {
      return NextResponse.json({
        summary: '아직 연습 기록이 없습니다. 스케일 연습이나 소리의 길에서 연습을 시작해보세요!',
        improvements: [],
        recommendations: ['1단계 설근 안정화부터 시작하세요', '하루 10분씩 꾸준히 연습하세요'],
        stats: { avgScore: 0, avgTension: 0, avgPitch: 0, sessionCount: 0 },
      });
    }

    const avgScore = Math.round(sessions.reduce((s, e) => s + e.score, 0) / sessions.length);
    const avgTension = Math.round(sessions.reduce((s, e) => s + e.tension, 0) / sessions.length);
    const avgPitch = Math.round(sessions.reduce((s, e) => s + e.pitchAccuracy, 0) / sessions.length);

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 500,
      system: `당신은 7년 경력의 보컬 트레이너입니다. 학생의 연습 데이터를 보고 간결한 성장 리포트를 작성합니다.
격려하되 솔직하게, 감각적 표현으로. JSON으로 응답하세요:
{"summary": "한 줄 요약", "improvements": ["개선된 점"], "recommendations": ["다음 주 추천"]}`,
      messages: [{
        role: 'user',
        content: `${period === 'daily' ? '오늘' : '이번 주'} 연습 데이터:
세션 수: ${sessions.length}회
평균 점수: ${avgScore}점
평균 긴장도: ${avgTension}
평균 음정 정확도: ${avgPitch}%
최근 점수 추이: ${sessions.slice(-5).map(s => s.score).join(' → ')}`,
      }],
    });

    const text = response.content.find(b => b.type === 'text')?.text ?? '';
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text, improvements: [], recommendations: [] };
    } catch {
      parsed = { summary: text, improvements: [], recommendations: [] };
    }

    return NextResponse.json({
      ...parsed,
      stats: { avgScore, avgTension, avgPitch, sessionCount: sessions.length },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    console.error('[/api/report]', msg);
    return NextResponse.json(
      { error: '리포트 생성에 실패했습니다.', code: 'REPORT_FAILED' },
      { status: 500 },
    );
  }
}

