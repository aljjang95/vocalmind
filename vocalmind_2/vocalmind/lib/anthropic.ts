import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

// 서버 전용 Anthropic 클라이언트
// 이 파일은 'server-only' 패키지로 클라이언트 번들 포함을 빌드 시 차단합니다
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Anthropic 클래스 재export — route.ts에서 import를 1줄로 통합
// import { anthropic, Anthropic } from '@/lib/anthropic'
export { Anthropic };

// Prompt caching 헬퍼 — SDK 0.27 타입에 cache_control 누락이므로 1곳에 캐스트를 집중
// 런타임은 지원. 시스템 프롬프트 전체를 5분 캐시로 재사용해 토큰 비용 절감.
export function cachedSystem(prompt: string) {
  return [
    {
      type: 'text' as const,
      text: prompt,
      cache_control: { type: 'ephemeral' as const },
    },
  ] as unknown as Anthropic.Messages.TextBlockParam[];
}
