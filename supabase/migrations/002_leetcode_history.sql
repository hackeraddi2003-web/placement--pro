-- ============================================================
-- Migration 002 — LeetCode / DSA history fields
-- Safe & additive: only adds columns with defaults, backfills
-- existing rows, never drops or renames anything. No data is lost.
-- Run once in the Supabase SQL Editor (idempotent — safe to re-run).
-- ============================================================

alter table dsa_problems
  add column if not exists time_minutes integer default 0;

alter table dsa_problems
  add column if not exists xp_earned integer;

-- One-time backfill for rows that predate this column (xp_earned is NULL).
-- Gated on NULL specifically so this is safe to re-run: once a row has any
-- value (including 15 for Medium), later re-runs never touch it again.
update dsa_problems
set xp_earned = case difficulty
  when 'Easy' then 10
  when 'Hard' then 25
  else 15
end
where xp_earned is null;

alter table dsa_problems
  alter column xp_earned set default 15;

-- Helpful for date-range history queries (calendar, charts).
create index if not exists idx_dsa_problems_user_date on dsa_problems(user_id, solved_date desc);
