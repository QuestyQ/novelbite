-- Optional v1.1 feedback fields for richer ledger learning.
-- Existing deployments remain usable; the browser falls back to the v1.0 columns if this migration is not applied.

alter table public.meal_logs
  add column if not exists feedback jsonb not null default '{}'::jsonb;

create index if not exists meal_logs_user_feedback_idx
  on public.meal_logs using gin (feedback);
