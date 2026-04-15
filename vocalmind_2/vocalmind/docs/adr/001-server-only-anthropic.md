# ADR-001: Anthropic API는 server-only 강제

## 상태: 확정 (2026-04-03)

## 맥락
Anthropic API 키가 클라이언트 번들에 포함되면 사용자가 DevTools에서 추출 가능. 과금 탈취 + 프롬프트 인젝션 위험.

## 결정
lib/anthropic.ts에 'server-only' import 강제. 모든 Claude 호출은 /api/* Route Handler에서만 수행.

## 결과
- 빌드 시점에 클라이언트 import 시 에러 발생 (안전망)
- API 키가 절대 클라이언트 번들에 포함 안 됨
- 클라이언트 → fetch('/api/chat') → 서버 → Anthropic 패턴 강제
