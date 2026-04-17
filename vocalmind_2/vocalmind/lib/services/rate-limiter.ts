// ── Rate Limiter 서비스 ─────────────────────────────────────────
// ⚠️  인메모리 구현: 단일 Node 프로세스 환경에서만 유효합니다.
// 프로덕션(Vercel 서버리스)에서는 함수 인스턴스마다 메모리가 초기화되므로
// Upstash Redis / Vercel KV 기반으로 교체해야 합니다.
// 참고: https://upstash.com/docs/redis/sdks/ratelimit-ts/overview

// ── 내부 버킷 타입 ─────────────────────────────────────────────
interface RateBucket {
  count: number;
  windowStart: number;
}

// ── 설정 타입 (호출부에서 오버라이드 가능) ──────────────────────
export interface RateLimitConfig {
  /** 윈도우당 허용 요청 수 (기본: 20) */
  limit?: number;
  /** 윈도우 크기 ms (기본: 60_000 = 1분) */
  windowMs?: number;
  /** 맵 최대 엔트리 수 — 메모리 누수 방지 (기본: 10_000) */
  storeMax?: number;
  /** 만료 엔트리 정리 주기 ms (기본: 60_000) */
  sweepIntervalMs?: number;
}

// ── 결과 타입 ──────────────────────────────────────────────────
export interface RateLimitResult {
  /** true = 요청 제한 초과 (429 반환 필요) */
  limited: boolean;
  /** 현재 윈도우에서 남은 요청 수 */
  remaining: number;
}

// ── 글로벌 카운터 설정 타입 ────────────────────────────────────
export interface GlobalRateLimitConfig {
  /** 윈도우당 전체 서버 최대 요청 수 (기본: 200) */
  limit?: number;
  /** 글로벌 윈도우 크기 ms (기본: 3_600_000 = 1시간) */
  windowMs?: number;
}

export interface GlobalRateLimitResult {
  /** true = 전체 서버 요청 초과 (503 반환 필요) */
  limited: boolean;
}

// ── 모듈 내부 상태 ─────────────────────────────────────────────
// 여러 API Route에서 공유하는 단일 Map (모듈 레벨 싱글톤)
const STORE = new Map<string, RateBucket>();
let lastSweep = Date.now();

// 글로벌 카운터
let globalCount = 0;
let globalWindowStart = Date.now();

// ── 내부 헬퍼: 만료 엔트리 정리 ──────────────────────────────
function sweepExpired(now: number, windowMs: number, sweepIntervalMs: number): void {
  if (now - lastSweep < sweepIntervalMs) return;
  lastSweep = now;
  STORE.forEach((bucket, key) => {
    if (now - bucket.windowStart > windowMs) {
      STORE.delete(key);
    }
  });
}

/**
 * IP 또는 userId 기반 인메모리 Rate Limit 체크.
 *
 * 사용 예시:
 * ```ts
 * const { limited } = checkRateLimit(ip, { limit: 10, windowMs: 60_000 });
 * if (limited) return NextResponse.json({ error: '...' }, { status: 429 });
 * ```
 *
 * @param identifier - IP 주소 또는 사용자 ID
 * @param config     - 선택적 설정 (기본값: limit=20, window=1분)
 * @returns RateLimitResult
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = {},
): RateLimitResult {
  const limit         = config.limit          ?? 20;
  const windowMs      = config.windowMs       ?? 60_000;
  const storeMax      = config.storeMax       ?? 10_000;
  const sweepInterval = config.sweepIntervalMs ?? 60_000;

  const now = Date.now();
  sweepExpired(now, windowMs, sweepInterval);

  // 맵 크기 상한 초과 시 가장 오래된 엔트리 삭제
  if (STORE.size >= storeMax) {
    const firstKey = STORE.keys().next().value;
    if (firstKey !== undefined) STORE.delete(firstKey);
  }

  const bucket = STORE.get(identifier);

  if (!bucket || now - bucket.windowStart > windowMs) {
    // 새 윈도우 시작
    STORE.set(identifier, { count: 1, windowStart: now });
    return { limited: false, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { limited: true, remaining: 0 };
  }

  bucket.count += 1;
  return { limited: false, remaining: limit - bucket.count };
}

/**
 * 전체 서버 기준 글로벌 Rate Limit 체크.
 * 분산 공격 시 Anthropic API 과금 폭탄 방지에 사용합니다.
 *
 * 사용 예시:
 * ```ts
 * const { limited } = checkGlobalRateLimit();
 * if (limited) return NextResponse.json({ error: '...' }, { status: 503 });
 * ```
 *
 * @param config - 선택적 설정 (기본값: limit=200, window=1시간)
 * @returns GlobalRateLimitResult
 */
export function checkGlobalRateLimit(
  config: GlobalRateLimitConfig = {},
): GlobalRateLimitResult {
  const limit    = config.limit    ?? 200;
  const windowMs = config.windowMs ?? 3_600_000;

  const now = Date.now();

  if (now - globalWindowStart > windowMs) {
    globalCount = 0;
    globalWindowStart = now;
  }

  globalCount += 1;
  return { limited: globalCount > limit };
}
