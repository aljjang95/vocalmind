# 보컬마인드 — 강한소상공인 사업계획서 v2 + HWP 양식 작성 (2026-05-06, 활성)

## 🔥 다음 세션 즉시 재개 지점

### 현재 상태 (2026-05-06 마감)
- ✅ 사업계획서 v2 MD 완성 — 요금제 구조 전면 개편 (크레딧제→현금 직결제+할인)
- ✅ DOCX 생성 완료 (59.6KB)
- ✅ **HWP 양식 채우기 완료** — RepeatFind+TableCellBlock+InsertText 전략으로 9/9 셀 교체 (70.5KB)
- ✅ fill_hwp_form.py 전략 v2: 짧은 마커 Find → 셀 선택 → 삭제 → 삽입

### 가격 모델 변경 요약 (이번 세션 확정)
- 크레딧제 폐지 → **현금 직결제**
- MV 단가: Draft 3,000원/30초, Pro 6,000원/60초, Studio 12,000원/60초+
- 정액 구독: 취미반 10만원/월, 발성전문반 15만원/월 (각각 MV 월 2편 포함)
- 초과분 다건 할인: 5편 10%, 10편 15%
- BEP: 정액 구독 8명으로 고정비 돌파

### 이어서 할 Step (우선순위 순)

#### Step 1: HWP 양식 채우기 (핵심 — 제출용) ✅ 완료
- [x] `scripts/fill_hwp_form.py` 전략 v2: RepeatFind(짧은 마커) → TableCellBlock → Delete → InsertText+BreakPara
- [x] 9/9 셀 교체 검증: 교체 텍스트 9건 존재 + 가이드 텍스트 서식2 측 제거 확인
- [x] 출력: `C:\Users\Administrator\Desktop\보컬마인드_강한소상공인\보컬마인드_강한소상공인_사업계획서_v2.hwp` (70.5KB)

#### Step 2: 마스터 검증
- [ ] 생성된 HWP 열어서 양식 표가 깨지지 않았는지 육안 확인
- [ ] 10p 이내 분량 확인
- [ ] 제출

### 참고 정보
- MD 원본: `C:\Users\Administrator\Desktop\보컬마인드_강한소상공인\보컬마인드_강한소상공인_사업계획서_v2.md`
- DOCX: `C:\Users\Administrator\Desktop\보컬마인드_강한소상공인\보컬마인드_강한소상공인_사업계획서_v2.docx`
- HWP COM 탐색 결과: `hwp.InitScan()`+`hwp.GetText()` 동작 확인. 서식2 고유 텍스트("한복제조업") 1회 출현, 공통 텍스트는 2회(서식1+서식2)
- 서식2(혁신) 구분 항목: 제품 한줄소개 / 기업소개 / 사업내용 / 사업성(혁신) / 주요성과 / 향후사업계획 / 기대효과 / 파트너사협업 / 협업기대효과

---

# Paradigm A-Lite (Phase 0 Bootstrap) 실행 계획

> **전략**: 자금이 스스로 모이는 종량제 MVP. 선투자 리스크 0.
> **목표**: 베타 1개월 내 첫 매출 100만원 → Phase 1 확장 자금 조달

## 문서 위치
- Phase 1 풀스펙 (자금 누적 후 사용): `vocalmind_2/vocalmind/docs/specs/2026-04-18-paradigm-a-phase1.md`
- Phase 1 기술 청사진: `vocalmind_2/vocalmind/docs/specs/2026-04-18-paradigm-a-phase1-architecture.md`
- 로드맵 메모리: `~/.claude/projects/.../memory/project_vocalmind_1m_roadmap.md`

## Phase 0 핵심 구조
- 유저 본인 MR 업로드만 (라이선스 리스크 0)
- 선불 크레딧 단건 결제 (토스페이먼츠, 월 정액 없음)
- 1크레딧 = 1,000원, 커버 1편 = 5크레딧
- 원가 ≈ 2,000원 / 판매가 5,000원 / 마진 60%
- SNS 자동 업로드 제외 → 유저가 MP4 다운로드
- Supabase Storage 유지 (R2 전환은 월 500MV 이후)

## 축소 범위 (Phase 1 대비 제외)
- ❌ SNS 자동 업로드 (F6 전체)
- ❌ 정기구독 / Stripe (F5 절반)
- ❌ 크리에이터 성과 대시보드 (F7)
- ❌ 수료→데뷔 자동 트리거 (F8)
- ❌ MR 라이선스 카탈로그 (F9)
- ❌ 광고 수익 분배
- ❌ 크리에이터 Starter/Creator/Pro 3티어
- ❌ Cloudflare R2

## 유지 범위 (Phase 0 포함)
- ✅ F1 AI 스튜디오 원클릭 파이프라인 (Demucs→RVC→FLUX→HunyuanVideo→LatentSync→FFmpeg)
- ✅ F2 개인 음색 모델 (Voice Identity)
- ✅ F3 MV 비주얼 스타일 엔진 (프리셋 2~4종)
- ✅ F4 아바타·립싱크
- ✅ 선불 크레딧 결제 (F5 단건만)
- ✅ 워터마크 C2PA
- ✅ 3단계 모더레이션

## DB 축소 버전 (5개만)
1. studio_credits_ledger (append-only + consume_credits RPC)
2. voice_identities
3. studio_jobs (큐+상태머신+감사)
4. covers
5. moderation_events
- ❌ mr_catalog, sns_connections, publish_tasks, publish_metrics, revenue_share_ledger (Phase 1 이후)

## 4주 마일스톤

### W1 — 기초 레이어 [✅ 완료]
- [x] `supabase/migrations/20260418_studio_phase0.sql` — 5 tables + 3 functions + 7 RLS policies + Realtime publication
- [x] `backend/infra/runware_client.py` — FLUX/HunyuanVideo/LatentSync 래퍼 + 8 단위 테스트 PASS
- [x] `backend/services/credits.py` — consume/grant/refund_job + 9 단위 테스트 PASS
- [x] `types/studio.ts` — StudioJob/VoiceIdentity/Cover/CreditLedgerEntry + 배럴 등록 (tsc 0 에러)
- [x] **Supabase 마이그레이션 배포 완료** (Management API 경유, Dashboard Table Editor 확인 가능)
- [x] **Runware 라이브 API 호출 검증** — FLUX Schnell 512x512 이미지 정상 반환
- [x] **.env.local SERVICE_ROLE_KEY placeholder → 실제 키 교체**
- [x] **Supabase RPC consume_credits 실전 호출 검증** — INSUFFICIENT_CREDITS 정상 반환
- [x] `backend/modal_compose.py` — FFmpeg concat + 자막 + 16:9/9:16 + C2PA + Supabase Storage 업로드 + **12 단위 테스트 PASS**

### W2 — 파이프라인 코어 [✅ 완료]
- [x] `backend/services/studio_pipeline.py` — 상태머신 드라이버 (transition/mark_failed/increment_attempt)
- [x] `backend/routers/orchestrator.py` + main.py 등록 — `/orchestrator/start` + `/callback/{modal,runware}` + **15 단위 테스트 PASS**
- [x] `backend/services/modal_dispatcher.py` — Demucs/RVC/Compose HTTPS invoke 래퍼
- [x] orchestrator stub → 실제 dispatch 연결 (`_signed_url` + `modal_dispatcher.dispatch_*`)
- [x] `app/api/credits/balance/route.ts` + `app/api/studio/jobs/route.ts` (POST, 크레딧 차감 + orchestrator dispatch + 자동 환불)
- [x] `app/api/studio/upload/route.ts` — MR/녹음/아바타 Storage 업로드 라우트
- [x] `lib/hooks/useStudioJob.ts` — Supabase Realtime 단일 job 구독
- [x] `app/studio/page.tsx` + `StudioHomeClient.tsx` — 스튜디오 홈 (크레딧 뱃지 + 최근 작업 + CTA)
- [x] `app/studio/new/NewCoverWizardClient.tsx` — 5단계 위저드 (MR→녹음→스타일→아바타→제출)
- [x] `ORCHESTRATOR_SECRET` 양쪽 환경변수 자동 생성 + 동기화
- [x] Supabase Storage 4개 버킷 생성 (`studio-mr`, `studio-recording`, `studio-avatar`, `mv-output`) + 유저별 RLS 정책
- [x] 전체 백엔드 회귀: **308 PASS** 유지 / Frontend tsc 0 에러 / build 성공 (`/studio/new` 3.68kB)

### W3 — 유저 플로우 완성 [✅ 대부분 완료]
- [x] `/studio/[coverId]` 프리뷰 페이지 (Realtime 진행률 + MP4 다운로드 + 16:9/9:16 토글 + C2PA 뱃지)
- [x] Voice Identity 등록 페이지 (`/studio/voice-identity` — 10문장 순차 녹음 + 진행률 + POST /api/voice-identity/train)
- [x] 토스페이먼츠 크레딧 충전 (`/credits` 위젯 + `/credits/success` confirm + `/credits/fail` 랜딩 + `POST /api/credits/topup/confirm` 멱등 orderId)
- [x] scene_planner (Claude Haiku + 4스타일 fallback 프롬프트 — 10 tests PASS)
- [x] scene_dispatcher (Runware FLUX + HunyuanVideo 오케스트레이션) + orchestrator 와이어 (`_dispatch_step("scene_planning")` → run_scene_pipeline → lipsync → composing 자동 체이닝, ffprobe duration)
- [x] modal_demucs/rvc/compose — spawn + callback 패턴으로 통일 (`_process_*` 워커가 Supabase Storage 업로드 후 `X-Orchestrator-Secret` 헤더로 callback POST). RVC는 `convert_studio` 엔드포인트 신설(기존 `/convert`는 ai-cover 용도로 보존). modal_dispatcher URL 업데이트. 백엔드 318 PASS + Python AST OK.
- [ ] **Modal CLI로 3개 앱 배포** (마스터 액션 필요): `modal deploy modal_demucs.py` + `modal_rvc.py` + `modal_compose.py`. 새 Secret: `vocalmind-orchestrator`(ORCHESTRATOR_SECRET)
- [x] **회귀 검증**: 백엔드 318 PASS / Frontend tsc 0 에러 / Next build 성공 (`/studio/voice-identity` 3.8kB, `/credits/success` 1.46kB)
- [x] **플로우 게이트 연결**: `/api/studio/jobs`가 ready 상태 voice_identity 자동 선택/검증 → 없으면 `VOICE_IDENTITY_REQUIRED` 응답 → 위저드 자동 redirect. `/studio` 홈에 `VoiceStatusCard` (ready/training/none) 추가, CTA 라벨 동적 전환 ("먼저 내 음색 등록하기" ↔ "커버 만들기 (5크레딧)")
- [x] **Phase 0 운영 도구 `/admin/voices`**: TEACHER_EMAIL 게이트 + training/ready/failed 필터 + 10문장 각각 signed URL 재생 + RVC 모델 경로 입력 후 승인(unique index 회피로 기존 ready는 archived 자동) / 실패 처리. `voice_identities.source_clips` JSONB 컬럼 마이그레이션 적용(Management API) + `/api/voice-identity/train`에서 저장. `lib/infra/admin-auth.ts` 재사용 가능한 `requireAdmin()` helper.
- [x] **AI 스튜디오 랜딩 섹션**: `components/marketing/AIStudioBeta.tsx` (3단계 스토리텔링 + 가격 5000원 + 베타 뱃지 + `/studio` CTA). `(marketing)/page.tsx`에 Demo ↔ Pricing 사이 삽입.

### W2 — 파이프라인 코어
- [ ] `backend/routers/orchestrator.py` + `services/studio_pipeline.py` 상태머신 드라이버
- [ ] Demucs → RVC → FLUX(1씬) → HunyuanVideo(1클립) → compose 일직선 연결
- [ ] `/api/studio/jobs` POST (크레딧 선차감 + orchestrator start)
- [ ] `/studio/new` 위저드 UI (MR 업로드·녹음·스타일·아바타 4단계)
- [ ] `lib/hooks/useStudioJob.ts` — Supabase Realtime 진행률
- [ ] Zustand `studioStore`

### W3 — 유저 플로우 완성
- [ ] `/studio/voice-identity` — 10문장 녹음 + 카메라 liveness + modal_rvc train 연결
- [ ] `/credits` + 토스페이먼츠 크레딧 충전 (기존 confirm 확장)
- [ ] `/studio/[coverId]` — 프리뷰 + 썸네일 + MP4 다운로드
- [ ] 크레딧 환불 플로우 (실패 자동)
- [ ] 스타일 프리셋 2종 (cinematic, cozy) 완성

### W3.5 — 자율 개선 세션 (2026-04-18, 마스터 부재)
- [x] 백엔드 테스트 318 → **333 PASS** (orchestrator scene_planning/lipsync 분기 + scene_dispatcher cost 누적 + _probe_duration 엣지케이스 = +15건)
- [x] 4개 스타일 프리셋 프롬프트 고도화 — 각 스타일별 anchor 토큰(ARRI/Kinfolk/Blade Runner/Ghibli) + 6씬 배열로 확장. LLM 경로에도 anchor 부착해 i2i 일관성 보장.
- [x] `studio_jobs.cost_usd_actual` 실측 — Runware 이미지/비디오 응답 cost 필드 누적. `scene_dispatcher.increment_cost_usd()` SELECT→UPDATE 2단계 원자적 갱신.
- [x] `docs/ops/phase0-runbook.md` — Phase 0 1인 운영자 룬북 (일일 점검 SQL / 수동 RVC 학습 / 장애 플레이북 / 월간 마진 검증 / 배포 체크리스트)
- [x] `/studio/new` UX — 원가 뱃지(5크레딧=5000원), MR 가이드(4줄 hint + 40MB 프리체크), 제출 단계 요약 dl (스타일/아바타/비용/시간)
- [x] `/studio/[coverId]` — FailurePanel 컴포넌트 통일(failed/refunded 분기), 실패 단계 한국어 매핑, "다시 만들기" CTA, 30분+ 환불 지연 시 문의 안내
- [x] 보안: `/api/studio/jobs` 경로 소유권 검증(PATH_OWNERSHIP_VIOLATION), `/api/voice-identity/train` duration 1~60s + storagePath 중복/소유권 + clip 최대 15개
- [x] 백엔드 startup env 체크 — `_check_phase0_env()` + `/health`에 `phase0_missing_env` 노출. 운영자가 환경변수 누락 조기 발견.
- [x] `/studio` 홈 pagination + 필터 — 전체/진행중/완료/실패 4탭 + 10개씩 "더 보기" 무한 스크롤.
- [x] `docs/adr/002-phase0-bootstrap.md` — Phase 0 결정 배경 + 5개 대안 비교 + Phase 1 전환 조건 4개 명시.

### W4 — 베타 런칭
- [ ] 내부 알파 20명 테스트
- [ ] 원가·품질·속도 측정 및 튜닝
- [x] 스타일 프리셋 4종 완성
- [x] **모더레이션 3단계 통합** — `backend/services/moderation.py` (upload/voice_identity/cover_output 3단계 규칙 기반 + moderation_events 로깅 + enforce). orchestrator `modal_callback`의 watermarking 성공 시점에 Stage 3 게이트 연결(위반 → mark_failed + 자동 환불). 테스트: `tests/test_moderation.py` 42건 + `TestStage3ModerationGate` 4건 = **+46건**, 전체 백엔드 333 → **379 PASS**.
- [x] 랜딩 페이지 "AI 스튜디오 베타" 섹션 추가
- [ ] 공개 베타 오픈

### W4.5 — 품질 티어 업그레이드 (2026-04-18 마스터 각인 반영)
> 마스터 지시: "RunwareAPI의 다른 모델 써도 좋으니 최고 결과. 단 낭비 리스크 조심."
>
> 단일가 5크레딧/5,000원 → **Draft/Pro/Studio 3티어**로 재설계. 고품질 모델 허용하되 예산 가드 내장.

- [x] `backend/infra/runware_catalog.py` — TIERS + STYLE_ANCHORS + select_model/apply_style/validate_tier (22 tests PASS)
- [x] `backend/infra/runware_client.py` — **RUNWARE_DRY_RUN=1 무과금 리허설**, Seedream referenceImages(14장 상한), FLUX steps/CFG 조건부. (+9 tests)
- [x] `backend/services/scene_dispatcher.py` — `tier` 파라미터 + **BudgetExceeded 가드**(누적 원가가 티어 예산 초과 전 중단), 이미지 모델·해상도·비디오 모델·해상도 자동 선택. (+12 tests)
- [x] `backend/routers/orchestrator.py` — `run_scene_pipeline`에 `tier=job.quality_tier` 전달, 잘못된 티어는 DEFAULT_TIER로 폴백
- [x] `supabase/migrations/20260418_studio_quality_tiers.sql` — `studio_jobs.quality_tier`(text) + `budget_usd`(numeric) + `idx_studio_jobs_tier_status` 인덱스 + `studio_tier_catalog` 뷰
- [x] `types/studio.ts` — `QualityTier` 타입 + `STUDIO_TIERS` 3카드 상수 + `StudioJob.qualityTier/budgetUsd` 필드
- [x] `app/api/studio/jobs/route.ts` — `qualityTier` 바디 필드 + 검증 + DB insert에 `quality_tier/budget_usd` 저장
- [x] `app/studio/new/NewCoverWizardClient.tsx` — **4단계 티어 선택 UI** (Draft/Pro/Studio 3카드, 추천 배지, 모델·해상도·씬수 표시) + Header·Submit 요약 동적 가격 표시
- [x] 회귀: **백엔드 379 → 422 PASS (+43)**, tsc 0 에러, Next build 성공 (`/studio/new` 3.68kB → 5.39kB)

**티어 스펙 확정 (2026-04-18):**
| 티어 | 모델 스택 | 길이 | 크레딧 | 판매가 | 예산상한 |
|------|-----------|------|--------|--------|----------|
| Draft | FLUX Schnell + Wan 2.2 | 15s | 3 | 3,000원 | $2 |
| Pro ⭐ | Seedream 4.5 + Kling 2.6 Pro | 30s | 15 | 15,000원 | $7 |
| Studio 👑 | Seedream 5.0 Lite + Kling 3.0 Pro | 60s | 40 | 40,000원 | $18 |

**남은 액션 (과금 검증 — 마스터 승인 필요):**
- [x] **Phase B Round 1: 3티어 이미지 비교 완료** (2026-04-18)
  - 동일 프롬프트 `"a solo female vocalist on a dimly lit stage..."` 3티어 각 1장
  - Draft FLUX Schnell 1024×576 / Pro Seedream 4.5 2560×1440 / Studio Seedream 5.0 Lite 2880×1620
  - 1차 호출 Pro/Studio `invalidPixels 400` → `FAILURES.md #1` 박제 + 해상도 교정(카탈로그 `MODEL_MIN_PIXELS` 도입 + `validate_dimensions` 클라이언트 선검증)
  - 2차 호출 3티어 전량 성공. 파일 `backend/scripts/phase_b_samples/*.jpg` 보존
  - **판정**: Pro ↔ Draft 격차 압도적(실루엣 vs 프로 MV). Pro ↔ Studio는 스타일 차이 중심(사실 vs 영화). 3티어 가격 구조 정당화됨
  - **과금**: `cost_usd=0.0` 리포트 (Runware 실 대시보드에서 확인 필요 — 마스터 액션)
- [ ] Phase B Round 2 (선택): Pro 티어 비디오 1클립 i2v 검증 (~$0.5) — 이미지 움직임 품질 확인
- [ ] 공개 베타 오픈

**완료 기준**:
- 첫 곡 완성 평균 15분 이내 (Draft 5분 / Pro 12분 / Studio 25분)
- 티어별 실원가가 `budget_usd` 상한 이내
- 품질 MOS: Draft 3.0 / Pro 4.0 / Studio 4.5+
- 베타 1개월 내 첫 매출 **100만원**

## 마스터 처리 필요 (막힘 신호 1건)
- [ ] **Runware API 키 발급** → `~/.claude/secrets/api-keys.env`에 `RUNWARE_API_KEY=xxx` 추가
  - 가입: https://runware.ai → API Keys 메뉴 → Create new key
  - 예치금 $20~50으로 시작 가능 (종량제)

## 진행 상태
- [2026-04-18] Phase 0 Bootstrap 전략 확정, plan.md 작성
- [다음] W1 착수 — Runware 키 대기하면서 병렬로 DB 마이그레이션 + modal_compose + orchestrator 스켈레톤 작성 가능
