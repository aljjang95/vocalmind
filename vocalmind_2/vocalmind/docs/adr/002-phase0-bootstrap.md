# ADR-002 — Phase 0 Bootstrap 아키텍처

- **상태**: Accepted
- **결정일**: 2026-04-18
- **결정자**: APEX (마스터 승인)
- **대체**: 없음 (새 기능)
- **후속 영향**: Phase 1 전환 시 `ADR-003: R2 + Stripe 마이그레이션` 예상

## 1. 맥락 (Context)

$1M MRR 로드맵(Paradigm A — "AI 커버 공장")을 착수하되, 자금이 없는 1인 팀이 선투자 리스크 없이
즉시 매출을 낼 수 있는 부트스트랩 전략이 필요했다. 본래 Phase 1 풀스펙(`docs/specs/2026-04-18-paradigm-a-phase1.md`)은
다음 선투자를 요구했다:

- K-POP 라이선스 협상 $10K+
- Runware 예치금 $56K
- Cloudflare R2 스토리지 $2K/월
- Stripe 정기구독 사업자 등록
- SNS 자동 업로드 22종 OAuth 통합

마스터는 이 리스크를 회피하고 "자금이 모이면서 기능을 확장"하는 경로를 지시.

## 2. 결정 (Decision)

Phase 0 Bootstrap을 다음 4대 축소로 정의하고 즉시 착수:

| 영역 | Phase 1 | Phase 0 Bootstrap |
|------|---------|-------------------|
| 콘텐츠 소스 | MR 카탈로그 + 라이선스 | **본인 MR 업로드 전용** |
| 결제 | Toss + Stripe 정기구독 | **토스 선불 크레딧 단건만** |
| 스토리지 | Cloudflare R2 | **Supabase Storage 유지** |
| SNS 배포 | 22개 자동 업로드 | **유저 MP4 다운로드만** |
| 모델 서빙 | 전용 GPU 인스턴스 | **Modal 서버리스 (초당 과금)** |
| 가격 | 티어 3종 ($9.9~49.9/월) | **5크레딧=5000원 종량제** |

### 채택된 핵심 규약
- 1크레딧 = 1,000원 / 커버 1편 = 5크레딧
- Runware FLUX Schnell + HunyuanVideo (lipsync는 W4에서)
- 상태머신 13단계 with 낙관적 잠금 + 자동 환불
- spawn + callback 패턴으로 Modal ↔ FastAPI orchestrator 통신

## 3. 대안 검토

### A. Temporal / BullMQ 큐 도입
- **거부**: 1인 운영에 과함. Supabase `studio_jobs.status` + Realtime publication + FastAPI BackgroundTasks로 충분.

### B. Cloudflare R2 선도입
- **거부**: 월 500 MV 달성 이전에는 Supabase Storage 무료 티어로 충분.
  Egress 과금 시점(월 100GB+) 되면 ADR-003으로 R2 전환.

### C. Stripe 정기구독
- **거부**: 사업자 등록 + 법인 계좌 필요. 토스페이먼츠만으로 부트스트랩 가능 (개인 사업자 OK).

### D. SNS 자동 업로드 SDK
- **거부**: 광고모음 프로젝트에서 22개 SNS OAuth 전부 구현했으나 Phase 1로 미룸.
  유저가 직접 MP4 다운로드해서 업로드하는 편이 Phase 0 규모에 맞음.

### E. Playwright로 UI 테스트 자동화
- **보류**: 프론트 테스트 인프라(Vitest) 도입 비용 대비 ROI 낮음. Phase 1 전환 시 재검토.

## 4. 결과 (Consequences)

### 긍정
- 선투자 $0으로 시작 가능
- DB 5테이블만으로 운영 가능 (Phase 1은 13테이블)
- 1인 운영자가 `docs/ops/phase0-runbook.md`로 전체 장애 대응 가능
- 마진 60%+ 가능 (원가 2000원 / 판매가 5000원)

### 부정
- 유저가 본인 MR을 준비해야 해서 초기 전환율 낮을 수 있음
- 무료 체험 없음 (첫 결제 장벽)
- 자동 SNS 업로드 없어 바이럴 확산 약함
- voice_identity 학습을 수동으로 돌려야 함 (/admin/voices 워크플로우 §3.2)

### 중립
- ChromaDB는 Phase 1부터 활성화 예정 (`docs/specs/2026-04-18-paradigm-a-phase1.md` §F9).
  Phase 0에서는 scene_planner가 Claude Haiku + fallback 프롬프트만 사용.

## 5. 전환 조건 (Phase 0 → Phase 1)

다음 중 2개 이상 충족 시 ADR-003 작성 후 Phase 1 착수:
- 월 커버 완성 500편+
- MRR 300만원+ (월 60편 × 5만원 ARPU)
- Supabase egress 경고 수신
- 유저 문의 중 "매월 자동 결제" 요청 20건+

## 6. 참고

- Phase 0 실행 계획: `plan.md`
- Phase 1 풀스펙 (대기): `docs/specs/2026-04-18-paradigm-a-phase1.md`
- 기술 청사진: `docs/specs/2026-04-18-paradigm-a-phase1-architecture.md`
- 운영 룬북: `docs/ops/phase0-runbook.md`
