import { NextRequest, NextResponse } from 'next/server';
import { anthropic, Anthropic } from '@/lib/anthropic';
import {
  COACH_FEEDBACK_SYSTEM_PROMPT,
  buildCoachFeedbackUserMessage,
} from '@/lib/prompts/coach-feedback';
import type { ApiError, CoachFeedback } from '@/types';

// ── AI 설정 ─────────────────────────────────────────────────
const AI_MODEL = process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001';
const AI_MAX_TOKENS = 800;

// ── Rate Limit (인메모리) ───────────────────────────────────
interface RateBucket {
  count: number;
  windowStart: number;
}

const RATE_STORE = new Map<string, RateBucket>();
const RATE_LIMIT = 15; // 분당 15회
const RATE_WINDOW_MS = 60_000;
const RATE_STORE_MAX = 5_000;
const SWEEP_INTERVAL = 60_000;
let lastSweep = Date.now();

const GLOBAL_LIMIT = 60;
const GLOBAL_WINDOW_MS = 3600_000;
let globalCount = 0;
let globalWindowStart = Date.now();

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
const VALID_CONDITIONS = ['good', 'normal', 'tired', 'bad'] as const;

interface FeedbackRequest {
  stageId: number;
  stageName: string;
  pronunciation: string;
  guideText: string;
  score: number;
  condition: string;
  failStreak: number;
  pitchStats: {
    avgCents: number;
    worstNoteIndex: number;
    worstNoteCents: number;
    totalNotes: number;
    goodNotes: number;
  };
}

function validateRequest(body: unknown): FeedbackRequest | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  const stageId = b.stageId;
  if (typeof stageId !== 'number' || stageId < 1 || stageId > 50) return null;

  const score = b.score;
  if (typeof score !== 'number' || score < 0 || score > 100) return null;

  const condition = b.condition;
  if (typeof condition !== 'string' || !VALID_CONDITIONS.includes(condition as typeof VALID_CONDITIONS[number])) return null;

  const failStreak = b.failStreak;
  if (typeof failStreak !== 'number' || failStreak < 0) return null;

  const stageName = b.stageName;
  if (typeof stageName !== 'string' || stageName.length === 0 || stageName.length > 100) return null;

  const pronunciation = b.pronunciation;
  if (typeof pronunciation !== 'string' || pronunciation.length === 0 || pronunciation.length > 100) return null;

  const guideText = b.guideText;
  if (typeof guideText !== 'string' || guideText.length > 500) return null;

  const pitchStats = b.pitchStats;
  if (!pitchStats || typeof pitchStats !== 'object') return null;
  const ps = pitchStats as Record<string, unknown>;
  if (
    typeof ps.avgCents !== 'number' ||
    typeof ps.worstNoteIndex !== 'number' ||
    typeof ps.worstNoteCents !== 'number' ||
    typeof ps.totalNotes !== 'number' ||
    typeof ps.goodNotes !== 'number'
  ) return null;

  return {
    stageId: Math.round(stageId),
    stageName: stageName.slice(0, 100),
    pronunciation: pronunciation.slice(0, 100),
    guideText: (guideText || '').slice(0, 500),
    score: Math.round(score),
    condition,
    failStreak: Math.round(failStreak),
    pitchStats: {
      avgCents: Math.round(ps.avgCents as number),
      worstNoteIndex: Math.round(ps.worstNoteIndex as number),
      worstNoteCents: Math.round(ps.worstNoteCents as number),
      totalNotes: Math.round(ps.totalNotes as number),
      goodNotes: Math.round(ps.goodNotes as number),
    },
  };
}

// ── AI 응답 파싱 ────────────────────────────────────────────
function parseAIResponse(text: string): CoachFeedback | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    if (
      typeof parsed.feedback !== 'string' ||
      typeof parsed.suggestion !== 'string' ||
      typeof parsed.encouragement !== 'string' ||
      typeof parsed.shouldLowerBpm !== 'boolean'
    ) {
      return null;
    }

    return {
      feedback: parsed.feedback.slice(0, 500),
      suggestion: parsed.suggestion.slice(0, 500),
      encouragement: parsed.encouragement.slice(0, 300),
      shouldLowerBpm: parsed.shouldLowerBpm,
    };
  } catch {
    return null;
  }
}

// ── 기본 피드백 fallback ────────────────────────────────────
function getDefaultFeedback(score: number, failStreak: number): CoachFeedback {
  if (failStreak >= 5) {
    return {
      feedback: '오늘 많이 연습했어요.',
      suggestion: '내일 다시 도전하면 분명 나아질 거예요. 충분한 휴식이 실력 향상의 비결입니다.',
      encouragement: '꾸준히 하는 것 자체가 대단한 거예요.',
      shouldLowerBpm: true,
    };
  }

  if (failStreak >= 3) {
    return {
      feedback: '음정 정확도를 조금 더 높여보세요.',
      suggestion: 'BPM을 낮추고 한 음 한 음 정확하게 내는 연습을 해보세요.',
      encouragement: '천천히 해봐요. 속도보다 정확도가 먼저입니다.',
      shouldLowerBpm: true,
    };
  }

  if (score >= 80) {
    return {
      feedback: '전반적으로 좋은 음정 정확도를 보여주고 있어요.',
      suggestion: '이 느낌을 기억하고 다음 단계에서도 유지해보세요.',
      encouragement: '잘하고 있어요!',
      shouldLowerBpm: false,
    };
  }

  if (score >= 60) {
    return {
      feedback: '음정의 중심은 잡고 있지만 일부 음에서 흔들림이 있어요.',
      suggestion: '흔들리는 음을 찾아서 그 음만 반복 연습해보세요.',
      encouragement: '조금만 더 집중하면 합격할 수 있어요.',
      shouldLowerBpm: false,
    };
  }

  return {
    feedback: '음정 정확도를 높여보세요.',
    suggestion: '천천히 한 음씩 정확하게 내는 연습부터 시작해보세요.',
    encouragement: '연습하는 것 자체가 성장이에요. 힘내세요!',
    shouldLowerBpm: score < 40,
  };
}

// ── 핸들러 ──────────────────────────────────────────────────
export async function POST(
  request: NextRequest
): Promise<NextResponse<CoachFeedback | ApiError>> {
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
        { error: '유효하지 않은 요청입니다.', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    const userMessage = buildCoachFeedbackUserMessage({
      stageId: data.stageId,
      stageName: data.stageName,
      pronunciation: data.pronunciation,
      guideText: data.guideText,
      score: data.score,
      avgCents: data.pitchStats.avgCents,
      worstNoteIndex: data.pitchStats.worstNoteIndex,
      worstNoteCents: data.pitchStats.worstNoteCents,
      totalNotes: data.pitchStats.totalNotes,
      goodNotes: data.pitchStats.goodNotes,
      condition: data.condition,
      failStreak: data.failStreak,
    });

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      system: COACH_FEEDBACK_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const aiText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');

    const parsed = parseAIResponse(aiText);

    if (!parsed) {
      // Fallback to default feedback on parse failure
      const fallback = getDefaultFeedback(data.score, data.failStreak);
      return NextResponse.json(fallback);
    }

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`[/api/coach-feedback] ip=${ip} error=${message}`);

    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        // Return default feedback instead of error on AI rate limit
        const fallback = getDefaultFeedback(70, 0);
        return NextResponse.json(fallback);
      }
    }

    // On any server error, return fallback feedback instead of error
    const fallback = getDefaultFeedback(70, 0);
    return NextResponse.json(fallback);
  }
}
