-- ────────────────────────────────────────────────────────────
-- vocal_payments / vocal_user_plans RLS 정책
-- ────────────────────────────────────────────────────────────

-- Enable RLS
alter table if exists vocal_payments enable row level security;
alter table if exists vocal_user_plans enable row level security;

-- vocal_payments: 본인 결제 내역만 조회 가능
create policy "Users can view own payments"
  on vocal_payments for select
  using (auth.uid() = user_id);

create policy "Users can insert own payments"
  on vocal_payments for insert
  with check (auth.uid() = user_id);

-- vocal_user_plans: 본인 플랜만 조회 가능
create policy "Users can view own plan"
  on vocal_user_plans for select
  using (auth.uid() = user_id);

-- 플랜 생성은 본인만 가능 (업데이트는 service role 전용)
create policy "Users can insert own plan"
  on vocal_user_plans for insert
  with check (auth.uid() = user_id);
