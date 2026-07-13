# 보컬마인드 (HLB 보컬스튜디오) — Product Spec (2026-05-21 회고 골격)

## 0. 1줄 정의 (북극성)
> **노래 부르는 사용자의 4축 긴장 감지 + AI 감각 코칭 + 음성 합성 피드백을 제공하는 보컬 트레이닝 웹앱.**

## 1. 문제 (Why now)
- 보컬 학원 비용 + 1:1 코치 한계
- AI로 24/7 즉시 피드백 가능

## 2. 타깃 유저
| 페르소나 | 절박도 |
|---|---|
| 보컬 입문자 (취미) | 7 |
| 노래 잘하고 싶은 직장인 | 8 |
| 콘텐츠 크리에이터 | 7 |

## 3. 성공 지표
- Phase 13 진행 중 (이미 라이브 운영)
- [Phase 0 인터뷰 필요] D+30 DAU·MAU·구독 전환율

## 4. 명시적 비목표
- ❌ 작곡/믹싱 (보컬 트레이닝만)
- ❌ 실시간 라이브 스트리밍 (녹음 분석만)
- ❌ 데스크탑 앱 (웹앱 한정)
- ❌ RVC 학습 코드 (HLB보컬 자체 RVC 폐기, MEMORY.md 박제)

## 5. 경쟁 해자
- parselmouth 4축 긴장 감지 (호흡/발성/공명/음정) — 다른 앱 없음
- Claude Haiku 감각 코칭 (단순 점수 X)
- edge-tts 음성 합성 피드백 (텍스트 X 음성)

## 6. 가설
- 4축 긴장 감지가 사용자 향상에 실측 도움
- [Phase 0 인터뷰 필요] 구독 가격대 / 무료 ↔ 유료 라인

## 7. 수락 기능 (라이브 단계)
- [x] FastAPI :8001 + Next.js :3010 동시 가동 (`scripts/dev.sh`)
- [x] parselmouth 4축 감지 동작
- [x] Claude Haiku 코칭 응답
- [x] Supabase 인증 + 사용자 기록 저장
- [x] Vercel + Fly.io 배포

## 8. 리스크
| 리스크 | 영향 | 완화책 |
|---|---|---|
| Anthropic 잔액 부족 | 코칭 미동작 | DeepSeek 폴백 (api-fallback.md) |
| 마이크 권한/품질 차이 | 분석 정확도 ↓ | 사전 마이크 캘리브레이션 |
| FAILURES.md 박제 사고 반복 | 사용자 이탈 | 매 세션 FAILURES.md 의무 |

## 9. 기술 제약
- Next.js 14 + FastAPI + Zustand + Tone.js + Supabase
- 167 tests · Port 3010 / 8001
- 배포: Vercel (프론트) + Fly.io (백)

## 10. 다음 단계
- [Phase 0 인터뷰 필요] Phase 13 종료 후 다음 마일스톤
- 음성변환(HLB보컬) AI 커버 통합 (`/ai-cover` 페이지) — `docs/superpowers/specs/2026-04-04-ai-cover-webapp-design.md` 박제
