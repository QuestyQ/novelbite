-- NovelBite public demo schema
-- Run in a new, separate Supabase project. Never apply this to the private app project.

create extension if not exists pgcrypto;

create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id text not null,
  meal_name text not null,
  category text not null,
  style text,
  repetition_family text not null,
  additions jsonb not null default '[]'::jsonb,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  eaten_at timestamptz not null default now(),
  source_version text not null default 'catalogue-schema-1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text not null default 'balanced',
  shift_hours numeric(4, 2) not null default 6 check (shift_hours between 0 and 24),
  service_moment text not null default 'after',
  natural_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preferences_one_row_per_user unique (user_id)
);

create table if not exists public.weekly_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  shifts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weekly_schedules_one_week_per_user unique (user_id, week_start)
);

create index if not exists meal_logs_user_eaten_at_idx
  on public.meal_logs (user_id, eaten_at desc);

create index if not exists weekly_schedules_user_week_idx
  on public.weekly_schedules (user_id, week_start desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meal_logs_set_updated_at on public.meal_logs;
create trigger meal_logs_set_updated_at
before update on public.meal_logs
for each row execute function public.set_updated_at();

drop trigger if exists preferences_set_updated_at on public.preferences;
create trigger preferences_set_updated_at
before update on public.preferences
for each row execute function public.set_updated_at();

drop trigger if exists weekly_schedules_set_updated_at on public.weekly_schedules;
create trigger weekly_schedules_set_updated_at
before update on public.weekly_schedules
for each row execute function public.set_updated_at();

alter table public.meal_logs enable row level security;
alter table public.preferences enable row level security;
alter table public.weekly_schedules enable row level security;

-- meal_logs
create policy "Users read own meal logs"
on public.meal_logs for select to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users insert own meal logs"
on public.meal_logs for insert to authenticated
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users update own meal logs"
on public.meal_logs for update to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users delete own meal logs"
on public.meal_logs for delete to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

-- preferences
create policy "Users read own preferences"
on public.preferences for select to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users insert own preferences"
on public.preferences for insert to authenticated
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users update own preferences"
on public.preferences for update to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users delete own preferences"
on public.preferences for delete to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

-- weekly_schedules
create policy "Users read own weekly schedules"
on public.weekly_schedules for select to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

create policy "Users insert own weekly schedules"
on public.weekly_schedules for insert to authenticated
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users update own weekly schedules"
on public.weekly_schedules for update to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);

create policy "Users delete own weekly schedules"
on public.weekly_schedules for delete to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

revoke all on public.meal_logs from anon;
revoke all on public.preferences from anon;
revoke all on public.weekly_schedules from anon;

grant select, insert, update, delete on public.meal_logs to authenticated;
grant select, insert, update, delete on public.preferences to authenticated;
grant select, insert, update, delete on public.weekly_schedules to authenticated;
