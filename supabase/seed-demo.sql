-- NovelBite intentionally creates no fictional auth users.
-- Guest-mode sample ledger entries are generated in the browser and never reach Supabase.
-- This file is a safe, explicit no-op so `supabase db reset` has no personal seed data.

do $$
begin
  raise notice 'NovelBite demo schema seeded with no users and no personal data.';
end;
$$;
