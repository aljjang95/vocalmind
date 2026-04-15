import { NextRequest, NextResponse } from 'next/server';
import { anthropic, Anthropic } from '@/lib/anthropic';
import { VOCAL_COACH_SYSTEM_PROMPT } from '@/lib/prompts/vocal-coach';
import { matchFaq } from '@/lib/data/faqDatabase';
import { ChatResponse, ApiError } from '@/types';

// ── AI 설정 상수 ────────────────────────────────────────────
const AI_MODEL      = process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001';
const AI_MAX_TOKENS = 1000;

// ── 입력 상한 상수 ──────────────────────────────────────────
const MAX_CONTENT_LENGTH = 2000;  // 메시지 1개당 최대 글자 수
const MAX_MESSAGES       = 20;   // 히스토리 최대 개수 (전체 턴 기준)

// ── Rate Limit ──────────────────────────────────────────────
// ⚠️ 인메모리 구현: 단일 Node 프로세스 환경에서만 유효합니다.
// 프로덕션(Vercel 서버리스)에서는 함수 인스턴스마다 메모리가 초기화되므로
// Upstash Redis / Vercel KV 기반 rate limiter로 반드시 교체하세요.
// 참고: https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
interface RateBucket { count: number; windowStart: number; }
const RATE_STORE      = new Map<string, RateBucket>();
const RATE_LIMIT      = 20;
const RATE_WINDOW_MS  = 60_000;
const RATE_STORE_MAX  = 10_000;  // 메모리 누수 방지: 최대 엔트리 수
const SWEEP_INTERVAL  = 60_000;  // 만료 엔트리 정리 주기
let lastSweep         = Date.now();

// ── 글로벌 Rate Limit (전체 서버 기준) ─────────────────────
// 분산 공격 시 Anthropic API 과금 폭탄 방지
const GLOBAL_LIMIT        = 200;   // 시간당 전체 요청 상한
const GLOBAL_WINDOW_MS    = 3600_000;
let globalCount           = 0;
let globalWindowStart     = Date.now();

function sweepExpired(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL) return;
  lastSweep = now;
  RATE_STORE.forEach((bucket, key) => {
    if (now - bucket.windowStart > RATE_WINDOW_MS) {
      RATE_STORE.delete(key);
    }
  });
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  sweepExpired(now);

  // 맵 크기 상한 초과 시 가장 오래된 엔트리부터 삭제
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

// ── 메시지 유효성 검증 헬퍼 ────────────────────────────────
type ValidMessage = { role: 'user' | 'assistant'; content: string };

function validateMessage(m: unknown): m is ValidMessage {
  return (
    m !== null &&
    typeof m === 'object' &&
    ((m as Record<string, unknown>).role === 'user' ||
      (m as Record<string, unknown>).role === 'assistant') &&
    typeof (m as Record<string, unknown>).content === 'string' &&
    ((m as Record<string, unknown>).content as string).length > 0 &&
    ((m as Record<string, unknown>).content as string).length <= MAX_CONTENT_LENGTH
  );
}

/**
 * assistant role 인젝션 차단 + 대화 히스토리 보존
 *
 * 전략: user→assistant 교대 패턴을 강제한다.
 *   1. 각 원소를 기본 타입/길이 검증
 *   2. 첫 메시지는 반드시 user
 *   3. 연속된 동일 role 방지 (user→user 또는 assistant→assistant 제거)
 *   4. 배열은 반드시 user 메시지로 끝나야 함 (마지막이 user여야 AI가 응답)
 *   5. 최대 개수 상한
 *
 * 이 방식으로:
 *   - 정상 대화(u→a→u→a→u): 그대로 통과 → 문맥 보존 ✅
 *   - 인젝션 시도([u, a_fake, u_malicious]):
 *       a_fake는 클라이언트가 삽입한 것이므로 신뢰할 수 없으나,
 *       교대 패턴 자체는 통과함. Phase 2(DB 신뢰 소스)에서 완전 차단.
 *   - 연속 assistant 인젝션([u, a1, a2, u]): a2가 중복 제거됨 ✅
 *   - assistant로 시작하는 인젝션([a_fake, u]): a_fake 제거됨 ✅
 */
function sanitizeMessages(raw: unknown[]): ValidMessage[] {
  const candidates = raw
    .slice(0, MAX_MESSAGES * 2)  // 과도한 배열 먼저 슬라이스
    .filter(validateMessage);

  const result: ValidMessage[] = [];

  for (const msg of candidates) {
    if (result.length === 0) {
      // 첫 메시지는 반드시 user여야 함
      if (msg.role !== 'user') continue;
      result.push(msg);
    } else {
      const lastRole = result[result.length - 1].role;
      // 이전 메시지와 role이 같으면 건너뜀 (연속 중복 제거)
      if (msg.role === lastRole) continue;
      result.push(msg);
    }

    if (result.length >= MAX_MESSAGES) break;
  }

  // 마지막 메시지가 user여야 AI가 응답할 수 있음
  while (result.length > 0 && result[result.length - 1].role !== 'user') {
    result.pop();
  }

  return result;
}

// ── 핸들러 ─────────────────────────────────────────────────
export async function POST(
  request: NextRequest
): Promise<NextResponse<ChatResponse | ApiError>> {
  // Vercel은 x-forwarded-for를 신뢰할 수 있게 덮어쓰므로 안전.
  // 자체 서버 배포 시 nginx/proxy에서 헤더 신뢰 설정을 반드시 확인할 것.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  // 글로벌 rate limit 체크 (분산 공격 대응)
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
    const body = await request.json() as { messages?: unknown };

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: '유효하지 않은 요청입니다.', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // BUG-1 수정: 교대 패턴 검증으로 히스토리 보존 + 인젝션 차단
    const messages = sanitizeMessages(body.messages as unknown[]);

    if (messages.length === 0) {
      return NextResponse.json(
        { error: '유효한 메시지가 없습니다.', code: 'NO_VALID_MESSAGES' },
        { status: 400 }
      );
    }

    // FAQ 자동 응답 체크 — 매칭되면 API 호출 없이 즉시 응답
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user') {
      const content = typeof lastMsg.content === 'string' ? lastMsg.content : '';
      const faqMatch = matchFaq(content);
      if (faqMatch) {
        return NextResponse.json({ reply: faqMatch.answer } satisfies ChatResponse);
      }
    }

    const response = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      system: VOCAL_COACH_SYSTEM_PROMPT,
      messages,
    });

    const reply =
      response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('') || '죄송해요, 잠시 후 다시 시도해주세요 🙏';

    return NextResponse.json({ reply });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`[/api/chat] ip=${ip} error=${message}`);

    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: 'AI 서비스가 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.', code: 'AI_RATE_LIMITED' },
          { status: 503 }
        );
      }
      if (error.status && error.status >= 400 && error.status < 500) {
        return NextResponse.json(
          { error: '잘못된 요청입니다. 다시 시도해주세요.', code: 'BAD_REQUEST' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
