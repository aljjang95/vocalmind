import { NextRequest, NextResponse } from 'next/server';
import { anthropic, Anthropic } from '@/lib/anthropic';
import { DIAGNOSIS_SYSTEM_PROMPT } from '@/lib/prompts/diagnosis';
import { ApiError, DiagnosisRequest, DiagnosisResult, SelfEvalScores, ConcernKey } from '@/types';

// ── AI 설정 ─────────────────────────────────────────────────
const AI_MODEL      = process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001';
const AI_MAX_TOKENS = 1500;

// ── Rate Limit (인메모리) ───────────────────────────────────
interface RateBucket { count: number; windowStart: number; }
const RATE_STORE      = new Map<string, RateBucket>();
const RATE_LIMIT      = 5;         // 진단은 분당 5회로 제한
const RATE_WINDOW_MS  = 60_000;
const RATE_STORE_MAX  = 5_000;
const SWEEP_INTERVAL  = 60_000;
let lastSweep         = Date.now();

const GLOBAL_LIMIT       = 100;
const GLOBAL_WINDOW_MS   = 3600_000;
let globalCount          = 0;
let globalWindowStart    = Date.now();

function sweepExpired(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL) return;
  lastSweep = now;
  RATE_STORE.forEach((bucket, key) => {
    if (now - bucket.windowStart > RATE_WINDOW_MS) RATE_STORE.delete(key);
  });
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  sweepExpired(now);
  if (RATE_STORE.size >= RATE_STORE_MAX) {
    const firstKey = RATE_STORE.keys().next().value;
    if (firstKey !== undefined) RATE_STORE.delete(firstKey);
  }
  const bucket = RATE_STORE.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    RATE_STORE.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (bucket.count >= RATE_LIMIT) return true;
  bucket.count += 1;
  return false;
}

// ── 입력 검증 ───────────────────────────────────────────────
const VALID_VOICE_TYPES = ['저음', '중음', '고음'] as const;
const VALID_EXPERIENCE  = ['초보', '중급', '고급'] as const;
const VALID_CONCERNS: ConcernKey[] = [
  'high_notes', 'breath_control', 'pitch_accuracy', 'vocal_fatigue',
  'tone_quality', 'diction', 'stage_fear', 'range_expand', 'vibrato',
];

function validateRequest(body: unknown): DiagnosisRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  // basicInfo
  const bi = b.basicInfo;
  if (!bi || typeof bi !== 'object') return null;
  const info = bi as Record<string, unknown>;
  if (typeof info.nickname !== 'string' || info.nickname.length < 1 || info.nickname.length > 20) return null;
  if (!VALID_VOICE_TYPES.includes(info.voiceType as typeof VALID_VOICE_TYPES[number])) return null;
  if (!VALID_EXPERIENCE.includes(info.experience as typeof VALID_EXPERIENCE[number])) return null;
  if (typeof info.genre !== 'string' || info.genre.length > 30) return null;

  // concerns
  if (!Array.isArray(b.concerns) || b.concerns.length < 1 || b.concerns.length > 3) return null;
  for (const c of b.concerns) {
    if (!VALID_CONCERNS.includes(c as ConcernKey)) return null;
  }

  // goal
  if (typeof b.goal !== 'string' || b.goal.length < 1 || b.goal.length > 200) return null;

  // selfEval
  const se = b.selfEval;
  if (!se || typeof se !== 'object') return null;
  const scores = se as Record<string, unknown>;
  for (const key of ['pitch', 'breath', 'power', 'tone', 'technique']) {
    const v = scores[key];
    if (typeof v !== 'number' || v < 0 || v > 100) return null;
  }

  return {
    basicInfo: {
      nickname: info.nickname as string,
      voiceType: info.voiceType as DiagnosisRequest['basicInfo']['voiceType'],
      experience: info.experience as DiagnosisRequest['basicInfo']['experience'],
      genre: info.genre as string,
    },
    concerns: b.concerns as ConcernKey[],
    goal: b.goal as string,
    selfEval: scores as unknown as SelfEvalScores,
  };
}

// ── AI 응답 파싱 ────────────────────────────────────────────
function parseAIResponse(text: string): Omit<DiagnosisResult, 'id' | 'createdAt' | 'nickname'> | null {
  try {
    // JSON 블록 추출 (```json ... ``` 래핑 대응)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    if (
      typeof parsed.overallScore !== 'number' ||
      !parsed.scores ||
      !Array.isArray(parsed.strengths) ||
      !Array.isArray(parsed.weaknesses) ||
      !Array.isArray(parsed.recommendations) ||
      typeof parsed.suggestedCategory !== 'string' ||
      typeof parsed.summary !== 'string'
    ) {
      return null;
    }

    return {
      overallScore: Math.max(0, Math.min(100, Math.round(parsed.overallScore))),
      scores: {
        pitch: clamp(parsed.scores.pitch),
        breath: clamp(parsed.scores.breath),
        power: clamp(parsed.scores.power),
        tone: clamp(parsed.scores.tone),
        technique: clamp(parsed.scores.technique),
      },
      strengths: parsed.strengths.slice(0, 3),
      weaknesses: parsed.weaknesses.slice(0, 3),
      recommendations: parsed.recommendations.slice(0, 5),
      suggestedCategory: parsed.suggestedCategory,
      summary: parsed.summary,
    };
  } catch {
    return null;
  }
}

function clamp(v: unknown): number {
  const n = typeof v === 'number' ? v : 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// ── 고민 한글 매핑 ─────────────────────────────────────────
const CONCERN_LABELS: Record<ConcernKey, string> = {
  high_notes: '고음이 어려움',
  breath_control: '호흡이 부족함',
  pitch_accuracy: '음정이 불안정함',
  vocal_fatigue: '성대가 쉽게 피로해짐',
  tone_quality: '음색이 마음에 들지 않음',
  diction: '발음이 불명확함',
  stage_fear: '무대 위에서 긴장됨',
  range_expand: '음역대를 넓히고 싶음',
  vibrato: '비브라토를 배우고 싶음',
};

// ── 핸들러 ──────────────────────────────────────────────────
export async function POST(
  request: NextRequest
): Promise<NextResponse<DiagnosisResult | ApiError>> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  // 글로벌 rate limit
  const now = Date.now();
  if (now - globalWindowStart > GLOBAL_WINDOW_MS) {
    globalCount = 0;
    globalWindowStart = now;
  }
  globalCount += 1;
  if (globalCount > GLOBAL_LIMIT) {
    return NextResponse.json(
      { error: '서비스가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.', code: 'GLOBAL_RATE_LIMITED' },
      { status: 503 }
    );
  }

  if (checkRateLimit(ip)) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const data = validateRequest(body);

    if (!data) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다. 모든 필드를 확인해주세요.', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    const userMessage = `
사용자 정보:
- 닉네임: ${data.basicInfo.nickname}
- 음역: ${data.basicInfo.voiceType}
- 경험 수준: ${data.basicInfo.experience}
- 선호 장르: ${data.basicInfo.genre || '미정'}

현재 고민:
${data.concerns.map((c) => `- ${CONCERN_LABELS[c]}`).join('\n')}

목표:
${data.goal}

자기 평가 (0~100):
- 음정 정확도: ${data.selfEval.pitch}
- 호흡 안정성: ${data.selfEval.breath}
- 성량/파워: ${data.selfEval.power}
- 음색: ${data.selfEval.tone}
- 테크닉: ${data.selfEval.technique}

위 정보를 종합하여 JSON 형식으로 보컬 진단 결과를 생성해주세요.`;

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      system: DIAGNOSIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const aiText =
      response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');

    const parsed = parseAIResponse(aiText);

    if (!parsed) {
      return NextResponse.json(
        { error: 'AI 응답을 처리하지 못했습니다. 다시 시도해주세요.', code: 'PARSE_ERROR' },
        { status: 500 }
      );
    }

    const result: DiagnosisResult = {
      id: `diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      nickname: data.basicInfo.nickname,
      ...parsed,
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`[/api/diagnose] ip=${ip} error=${message}`);

    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'AI 서비스가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.', code: 'AI_RATE_LIMITED' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
