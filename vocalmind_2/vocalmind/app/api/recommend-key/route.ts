import { NextRequest, NextResponse } from 'next/server';
import { anthropic, Anthropic } from '@/lib/anthropic';
import { KEY_RECOMMENDATION_SYSTEM_PROMPT } from '@/lib/prompts/key-recommendation';
import type { ApiError } from '@/types';

// ── AI 설정 ─────────────────────────────────────────────────
const AI_MODEL      = process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001';
const AI_MAX_TOKENS = 500;

// ── Rate Limit (인메모리) ───────────────────────────────────
interface RateBucket { count: number; windowStart: number; }
const RATE_STORE      = new Map<string, RateBucket>();
const RATE_LIMIT      = 10;        // 분당 10회
const RATE_WINDOW_MS  = 60_000;
const RATE_STORE_MAX  = 5_000;
const SWEEP_INTERVAL  = 60_000;
let lastSweep         = Date.now();

const GLOBAL_LIMIT       = 50;
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

interface NoteRange {
  low: string;   // e.g. "E2"
  high: string;  // e.g. "G4"
}

interface KeyRecommendRequest {
  userRange: NoteRange;
  songRange: NoteRange;
}

const NOTE_PATTERN = /^[A-G]#?\d$/;

function validateRequest(body: unknown): KeyRecommendRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  const userRange = b.userRange;
  const songRange = b.songRange;

  if (!userRange || typeof userRange !== 'object') return null;
  if (!songRange || typeof songRange !== 'object') return null;

  const ur = userRange as Record<string, unknown>;
  const sr = songRange as Record<string, unknown>;

  if (typeof ur.low !== 'string' || !NOTE_PATTERN.test(ur.low)) return null;
  if (typeof ur.high !== 'string' || !NOTE_PATTERN.test(ur.high)) return null;
  if (typeof sr.low !== 'string' || !NOTE_PATTERN.test(sr.low)) return null;
  if (typeof sr.high !== 'string' || !NOTE_PATTERN.test(sr.high)) return null;

  return {
    userRange: { low: ur.low, high: ur.high },
    songRange: { low: sr.low, high: sr.high },
  };
}

// ── AI 응답 파싱 ────────────────────────────────────────────

interface KeyRecommendResponse {
  recommendedShift: number;
  reason: string;
}

function parseAIResponse(text: string): KeyRecommendResponse | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    if (
      typeof parsed.recommendedShift !== 'number' ||
      typeof parsed.reason !== 'string'
    ) {
      return null;
    }

    // Clamp to valid range
    const shift = Math.max(-6, Math.min(6, Math.round(parsed.recommendedShift)));

    return {
      recommendedShift: shift,
      reason: parsed.reason.slice(0, 500),
    };
  } catch {
    return null;
  }
}

// ── 핸들러 ──────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
): Promise<NextResponse<KeyRecommendResponse | ApiError>> {
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
      { status: 503 },
    );
  }

  if (checkRateLimit(ip)) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.', code: 'RATE_LIMITED' },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const data = validateRequest(body);

    if (!data) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다. 음역대 정보를 확인해주세요.', code: 'INVALID_REQUEST' },
        { status: 400 },
      );
    }

    const userMessage = `
사용자 음역대: ${data.userRange.low} ~ ${data.userRange.high}
곡 음역대: ${data.songRange.low} ~ ${data.songRange.high}

위 정보를 기반으로 최적의 키 시프트를 JSON 형식으로 추천해주세요.`;

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      system: KEY_RECOMMENDATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const aiText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');

    const parsed = parseAIResponse(aiText);

    if (!parsed) {
      return NextResponse.json(
        { error: 'AI 응답을 처리하지 못했습니다. 다시 시도해주세요.', code: 'PARSE_ERROR' },
        { status: 500 },
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`[/api/recommend-key] ip=${ip} error=${message}`);

    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'AI 서비스가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.', code: 'AI_RATE_LIMITED' },
          { status: 503 },
        );
      }
    }

    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', code: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
