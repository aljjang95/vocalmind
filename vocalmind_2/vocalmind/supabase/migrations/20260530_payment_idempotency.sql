-- 결제 멱등성 보장 — vocal_payments.toss_order_id UNIQUE
--
-- 배경: credits/topup/confirm + payment/confirm 양쪽 라우트가 동일 orderId 재호출 시
--       23505(unique_violation)를 멱등 성공으로 처리하도록 작성돼 있으나,
--       원본 스키마(20260414_phase13_social.sql:93)에 toss_order_id UNIQUE 제약이 없어
--       병렬/재시도 호출 시 중복 결제 기록 + 중복 플랜 upsert가 가능했음.
-- 효과: 동일 토스 orderId의 중복 insert를 DB가 거부 → 라우트의 멱등 분기가 실제 작동.
-- NULL: Postgres UNIQUE는 NULL을 중복 허용하므로 toss_order_id가 NULL인 레거시 행에는 영향 없음.
-- 주의: 적용 전 비-NULL 중복이 없어야 한다.
--   SELECT toss_order_id, count(*) FROM vocal_payments
--   WHERE toss_order_id IS NOT NULL GROUP BY toss_order_id HAVING count(*) > 1;

ALTER TABLE vocal_payments DROP CONSTRAINT IF EXISTS vocal_payments_toss_order_id_key;
ALTER TABLE vocal_payments ADD CONSTRAINT vocal_payments_toss_order_id_key UNIQUE (toss_order_id);
