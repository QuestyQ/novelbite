# Security policy

## Supported versions

Security fixes are applied to the latest public release.

## Reporting a vulnerability

Use GitHub’s **Report a vulnerability** option in the repository Security tab. Do not open a public issue when a report could expose another user’s data or an active credential.

Include the affected version, reproduction steps, impact and any suggested mitigation. Do not access data that is not yours, degrade the service or publish details before a fix is available.

## Secrets

Only Supabase publishable/anon keys may be present in browser configuration. Never commit Supabase secret or `service_role` keys, database passwords, SMTP credentials, Cloudflare API tokens, private menu data, personal exports or roster images.

`npm run release:check` performs a basic secret and private-brand audit. GitHub secret scanning remains an additional safety net, not a substitute for review.

## Security boundaries

Supabase RLS, not client-side filtering, is the authorization boundary. Client queries also include explicit `user_id` filters. Before public registration, verify the schema in a clean demo project with two distinct test users.
