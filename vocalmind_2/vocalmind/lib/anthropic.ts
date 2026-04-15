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
