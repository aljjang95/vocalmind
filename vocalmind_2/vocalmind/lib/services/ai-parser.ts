// ── AI JSON 응답 파싱 서비스 ─────────────────────────────────
// Claude Haiku가 반환하는 텍스트에서 JSON 블록을 추출하고 검증합니다.
// 8개 이상의 API Route에서 동일하게 반복되는 패턴을 캡슐화합니다.

/**
 * AI 텍스트 응답에서 JSON 객체를 추출하여 파싱합니다.
 *
 * 전략:
 *  1. 텍스트에서 `{...}` 패턴의 첫 번째 JSON 블록을 정규식으로 추출
 *  2. JSON.parse로 파싱
 *  3. requiredKeys가 제공된 경우, 모든 키가 존재하는지 검증
 *  4. 실패 시 null 반환 (throws 하지 않음)
 *
 * 사용 예시:
 * ```ts
 * const parsed = parseAiJsonResponse<{ stages: unknown[]; aiComment: string }>(
 *   aiText,
 *   ['stages', 'aiComment'],
 * );
 * if (!parsed) return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 });
 * ```
 *
 * @param text         - AI가 반환한 원본 텍스트
 * @param requiredKeys - 파싱 결과에 반드시 존재해야 하는 최상위 키 목록
 * @returns 파싱된 객체 또는 null
 */
export function parseAiJsonResponse<T = Record<string, unknown>>(
  text: string,
  requiredKeys?: (keyof T)[],
): T | null {
  try {
    // JSON 블록 추출 (마크다운 코드 블록 내부 포함)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as T;

    // 필수 키 검증
    if (requiredKeys && requiredKeys.length > 0) {
      const obj = parsed as Record<string, unknown>;
      for (const key of requiredKeys) {
        if (!(key as string in obj) || obj[key as string] === undefined) {
          return null;
        }
      }
    }

    return parsed;
  } catch {
    // JSON 파싱 실패 시 null 반환 (예외 전파 없음)
    return null;
  }
}

/**
 * AI 텍스트에서 JSON 배열을 추출하여 파싱합니다.
 * 응답이 배열 형태인 경우에 사용합니다.
 *
 * @param text - AI가 반환한 원본 텍스트
 * @returns 파싱된 배열 또는 null
 */
export function parseAiJsonArray<T = unknown>(text: string): T[] | null {
  try {
    // 배열 블록 추출
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (!arrayMatch) return null;

    const parsed = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(parsed)) return null;

    return parsed as T[];
  } catch {
    return null;
  }
}

/**
 * AI 응답 텍스트에서 순수 텍스트 블록을 추출합니다.
 * JSON이 아닌 일반 텍스트 응답에서 마크다운 코드 블록을 제거합니다.
 *
 * @param text    - AI가 반환한 원본 텍스트
 * @param maxLen  - 반환 텍스트 최대 길이 (기본: 1000)
 * @returns 정제된 텍스트
 */
export function extractAiText(text: string, maxLen = 1000): string {
  // 마크다운 코드 블록 제거
  const cleaned = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .trim();

  return cleaned.slice(0, maxLen);
}
