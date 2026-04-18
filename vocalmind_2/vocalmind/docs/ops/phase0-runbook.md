# Phase 0 운영 룬북

> **적용 시기**: 베타 1개월 내 첫 매출 100만 원 달성 전까지. 이후 Phase 1 전환 시 이 문서 폐기.
> **대상 독자**: 1인 운영자 (마스터).

## 1. 운영 아키텍처 한눈에

```
유저 요청 흐름:
  /studio/voice-identity → 10문장 녹음
      ↓
  voice_identities(status=training)
      ↓ [마스터 수동 처리 — 이 룬북 §3]
  voice_identities(status=ready)
      ↓
  /studio/new → 5단계 위저드 → /api/studio/jobs
      ↓
  studio_jobs(pending) → FastAPI /orchestrator/start
      ↓ [자동]
  Demucs → RVC → 믹싱 → scene_planning → FLUX → HunyuanVideo → (lipsync skip) → Compose → C2PA → completed
      ↓ [실패 시]
  mark_failed → 자동 환불 → status=refunded
```

## 2. 일일 점검 (5분/일)

### 2.1 재고 대시보드 (/admin/voices)
- **학습 대기** 건수 확인 → N개면 N번 RVC 학습 돌려야 함
- **실패** 탭에 새 항목 있는지 (사유 기록 필요)

### 2.2 SQL 대시보드 (Supabase SQL Editor)

```sql
-- 오늘 매출 (원)
select sum(amount) as revenue_today
from vocal_payments
where plan = 'credits'
  and status = 'completed'
  and created_at >= current_date;

-- 오늘 제출된 커버 작업 + 상태 분포
select status, count(*) from studio_jobs
where created_at >= current_date
group by status
order by count desc;

-- 환불된 작업 (실패 원인 점검 필수)
select id, failed_step, last_error, created_at
from studio_jobs
where status in ('failed', 'refunded')
  and created_at >= current_date - interval '7 days'
order by created_at desc
limit 20;

-- 원가 실측 (이번 주)
select
  count(*) filter (where status='completed') as completed,
  avg(cost_usd_actual) filter (where status='completed') as avg_cost,
  max(cost_usd_actual) as max_cost,
  sum(cost_credits * 1000) as revenue_krw,
  sum(cost_usd_actual) * 1400 as cost_krw
from studio_jobs
where created_at >= current_date - interval '7 days';

-- 학습 대기 적체 (LTV 신규 유저 막힘 지표)
select count(*) as pending_voice_identities
from voice_identities
where status = 'training';
```

### 2.3 Fly.io / Vercel / Modal 헬스체크
- `fly status -a vocalmind-backend` (min_machines=0이라 stopped 정상)
- Vercel: 마지막 배포 Deployment Ready
- Modal: `modal app list` → `vocalmind-{demucs,rvc,compose}` Ready

## 3. Voice Identity 수동 학습 워크플로우 (유저 1명 = 약 10분)

### 3.1 /admin/voices에서 클립 검토
1. `TEACHER_EMAIL` 계정으로 로그인
2. "학습 대기" 탭에서 대상 선택
3. "▶ 녹음 클립 듣기" → 10개 모두 재생
4. **거절 조건** (→ "✗ 실패 처리"):
   - 욕설/혐오 발언
   - 명백히 다른 사람 목소리 (naminghijack)
   - 녹음 품질 최악 (배경 소음 90%+)
5. 문제 없으면 §3.2로

### 3.2 로컬에서 RVC 학습
```bash
# 1) 클립 10개 다운로드 (admin 페이지의 ▶ 버튼 링크에서 URL 복사)
mkdir -p /tmp/voice-<user-short>
cd /tmp/voice-<user-short>
# 각 signed URL을 curl로 다운로드

# 2) Modal RVC train 호출 (기존 ai-cover 학습 엔드포인트 재사용)
curl -X POST https://vocalmind--vocalmind-rvc-train.modal.run \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "<user_uuid>",
    "model_id": "<voice_identity_id>",
    "model_name": "voice_<short>",
    "recording_paths": ["<bucket>/<path1>", ...],
    "epochs": 50
  }'
```

### 3.3 /admin/voices에서 승인
1. 학습 완료 후 반환된 `model_path` / `index_path` 복사
2. 대상 카드에 입력 → MOS 점수 (3.5+면 정상)
3. "✓ 승인 (ready)" 클릭
4. 유저는 즉시 `/studio/new`에서 커버 제작 가능

**SLA 목표**: 등록 후 12시간 이내 승인. 하루 1회 배치 처리로 충분.

## 4. 장애 대응 플레이북

### 4.1 유저가 "커버 만들기 눌렀는데 아무 반응 없음"
```sql
select id, status, last_error, failed_step
from studio_jobs
where user_id = '<uuid>'
order by created_at desc
limit 5;
```
- `status=pending` + `last_error=orchestrator dispatch 실패` → **FastAPI 백엔드 다운**. `fly status` 확인 후 `fly machine start`
- `status=vocal_separating` 에서 10분+ 정체 → **Modal demucs 스케일다운 중**. 재호출 1회 자동 시도됨 (attempt_count).

### 4.2 "크레딧 차감됐는데 영상 안 나옴"
```sql
-- 원장 확인
select * from studio_credits_ledger
where user_id = '<uuid>'
order by created_at desc
limit 20;
```
- `reason='cover_consume'` 있고 매칭되는 `job_refund` 없고 `status != 'completed'` →
  수동 환불:
  ```sql
  select grant_credits(
    p_user_id := '<user_uuid>'::uuid,
    p_amount := 5,
    p_reason := 'manual_refund',
    p_job_id := '<job_uuid>'::uuid,
    p_payment_id := null,
    p_metadata := '{"operator_note": "수동 환불 — Modal 장애"}'::jsonb
  );
  ```
  → `studio_jobs.status='refunded'`로 업데이트

### 4.3 Runware API 한도 초과
- `last_error` 에 `Runware 429` 또는 `quota_exceeded`
- 조치: Runware 대시보드에서 예치금 충전 → 자동 재시도됨 (max_attempts=3)

### 4.4 Modal 함수 콜드스타트 타임아웃
- `last_error` 에 `Modal 504` 또는 httpx timeout
- 조치: Modal 대시보드에서 해당 앱 확인 → 필요 시 `min_containers=1`로 상시 기동 (Phase 0 비용 감내 가능할 때만)

## 5. 월간 점검 (1시간/월)

### 5.1 마진 검증
```sql
select
  date_trunc('month', created_at) as month,
  count(*) filter (where status='completed') as covers,
  sum(cost_credits * 1000) as revenue_krw,
  sum(cost_usd_actual) * 1400 as cost_krw,
  (sum(cost_credits * 1000) - sum(cost_usd_actual) * 1400) / nullif(sum(cost_credits * 1000), 0) as margin
from studio_jobs
where status = 'completed'
group by 1
order by 1 desc;
```
- **목표 마진 60% 이상**. 50% 미만이면 가격 조정 또는 cost 최적화 필요.

### 5.2 ghost 유저 정리
- 1개월 접속 없고 잔액 있는 유저 → 유지 (환불 의무 없음)
- 1년 미접속 + 잔액 0 → auth.users 삭제 (개인정보 보호)

### 5.3 아카이브된 voice_identity의 rvc_model_path 파일 삭제
```sql
select rvc_model_path from voice_identities
where status = 'archived' and created_at < current_date - interval '90 days';
```
- 위 경로들을 Supabase Storage에서 수동 삭제 (스토리지 비용 절감)

## 6. 배포 체크리스트

### 6.1 Frontend (Vercel 자동)
- `master` 브랜치 push → 자동 배포
- 환경변수 변경 후: Vercel Dashboard → Settings → Environment Variables → Redeploy

### 6.2 Backend (Fly.io)
```bash
cd vocalmind_2/vocalmind/backend
fly deploy
```

### 6.3 Modal (변경 시)
```bash
cd vocalmind_2/vocalmind/backend
PYTHONIOENCODING=utf-8 modal deploy modal_demucs.py
PYTHONIOENCODING=utf-8 modal deploy modal_rvc.py
PYTHONIOENCODING=utf-8 modal deploy modal_compose.py
```
- 신규 배포 시 `.env`에 Modal URL 추가/갱신 필요:
  - `MODAL_DEMUCS_URL`
  - `MODAL_RVC_URL` → `convert_studio` 엔드포인트 (기존 `convert` 아님!)
  - `MODAL_COMPOSE_URL`

### 6.4 DB 마이그레이션 적용
```bash
# Management API (Supabase Dashboard 비밀번호 불필요)
curl -X POST "https://api.supabase.com/v1/projects/kyfcmemrwmdjlaozsxap/database/query" \
  -H "Authorization: Bearer <SUPABASE_PAT>" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{"query": "<SQL 내용>"}
EOF
```

## 7. 에스컬레이션

개인 판단 못 할 때 상의 대상:
- **법무**: 유저 분쟁, DMCA 신고
- **개발 (APEX)**: 신규 기능 요청, 리팩토링, 스키마 변경
- **Supabase 유료 문의**: DB 성능 저하 (무료 티어 한계 도달 시)

---

**업데이트 이력**
- 2026-04-18 최초 작성 (Phase 0 Bootstrap)
