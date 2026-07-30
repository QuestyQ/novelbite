# Supabase setup

Use a brand-new Supabase project such as `novelbite-demo`. Do not reuse the private
application project.

## Apply the schema

With the Supabase CLI linked to the demo project:

```bash
supabase db push
```

The migrations create `meal_logs`, `preferences`, and `weekly_schedules`, enable Row
Level Security, add select/insert/update/delete policies scoped to `auth.uid()`, and add
the `delete_own_account()` RPC.

The browser also includes explicit `.eq("user_id", user.id)` filters. Those filters
improve clarity and query planning; RLS remains the security boundary.

## Browser configuration

Copy `config.example.js` to `public/config.js` and add only:

- the demo project URL;
- a publishable/anon client key;
- an optional public support URL.

Never put a secret key, `service_role` key, database password, SMTP credential, or
Cloudflare token in browser configuration.

## Verification

Before enabling registrations:

1. Create two temporary users.
2. Insert a meal as user A.
3. Confirm user B cannot select, update, or delete it.
4. Run the automated static RLS checks with `npm test`.
5. Test data export, ledger deletion, and account deletion.

The seed is intentionally empty. Guest sample entries live only in browser storage.
