import { NextRequest, NextResponse } from 'next/server';
import { anthropic, Anthropic } from '@/lib/anthropic';
import { PRONUNCIATION_SYSTEM_PROMPT } from '@/lib/prompts/pronunciation';
import type { ApiError } from '@/types';

// ── AI 설정 ─────────────────────────────────────────────────
const AI_MODEL      = process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001';
const AI_MAX_TOKENS = 2000;

// ── Rate Limit (인메모리) ───────────────────────────────────
interface RateBucket { count: number; windowStart: number; }
const RATE_STORE      = new Map<string, RateBucket>();
const RATE_LIMIT      = 10;          // 분당 10회
const RATE_WINDOW_MS  = 60_000;
const RATE_STORE_MAX  = 5_000;
const SWEEP_INTERVAL  = 60_000;
let lastSweep         = Date.now();

const GLOBAL_LIMIT       = 50;       // 시간당 50회
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
const VALID_LANGUAGES = ['en', 'ja', 'zh', 'es'] as const;
type Language = typeof VALID_LANGUAGES[number];

interface PronunciationRequest {
  lyrics: string;
  language: Language;
}

function validateRequest(body: unknown): PronunciationRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  if (typeof b.lyrics !== 'string' || b.lyrics.trim().length === 0 || b.lyrics.length > 10000) return null;
  if (!VALID_LANGUAGES.includes(b.language as Language)) return null;

  return {
    lyrics: b.lyrics.trim(),
    language: b.language as Language,
  };
}

// ── AI 응답 파싱 ────────────────────────────────────────────
interface PronunciationLine {
  original: string;
  korean: string;
}

interface PronunciationResponse {
  lines: PronunciationLine[];
}

function parseAIResponse(text: string): PronunciationResponse | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed.lines) || parsed.lines.length < 1) return null;

    const validLines: PronunciationLine[] = [];
    for (const line of parsed.lines) {
      if (typeof line.original !== 'string' || typeof line.korean !== 'string') continue;
      validLines.push({
        original: line.original.slice(0, 500),
        korean: line.korean.slice(0, 500),
      });
    }

    if (validLines.length < 1) return null;

    return { lines: validLines };
  } catch {
    return null;
  }
}

// ── 언어 라벨 ───────────────────────────────────────────────
const LANG_LABELS: Record<Language, string> = {
  en: '영어',
  ja: '일본어',
  zh: '중국어',
  es: '스페인어',
};

// ── 핸들러 ──────────────────────────────────────────────────
export async function POST(
  request: NextRequest
): Promise<NextResponse<PronunciationResponse | ApiError>> {
  const rawIp =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const ip = rawIp.replace(/[^0-9a-fA-F.:]/g, '').slice(0, 45);

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
        { error: '유효하지 않은 요청입니다. 가사와 언어를 확인해주세요.', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    const userMessage = `
언어: ${LANG_LABELS[data.language]} (${data.language})

가사:
${data.lyrics}

위 가사를 한국어 발음으로 변환하여 JSON 형식으로 응답해주세요.`;

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      system: PRONUNCIATION_SYSTEM_PROMPT,
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

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`[/api/pronunciation] ip=${ip} error=${message}`);

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
