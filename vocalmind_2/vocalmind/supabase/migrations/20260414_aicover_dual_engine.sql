-- ────────────────────────────────────────────────────────────
-- Phase 12: AI 커버 듀얼 엔진 — engine 컬럼 추가
-- ────────────────────────────────────────────────────────────

-- ai_cover_conversions에 engine 컬럼 추가 (rvc 기본, hq_svc 옵션)
alter table if exists ai_cover_conversions
  add column if not exists engine text default 'rvc';

-- 녹음 데이터 총량 추적용 뷰 → 20260414_recordings.sql로 이동
-- (recordings 테이블 생성 후 뷰 생성해야 함)
