# Privacy design

NovelBite treats public code and a public registration service as different release
levels.

## Public code

This repository contains only fictional menu data, source code, migrations,
documentation, and publishable-key placeholders. It excludes real comments, real
schedules, roster images, production identifiers, and credentials.

## Guest and local modes

Both modes are account-free. Data stays in namespaced browser local storage and is sent
nowhere by NovelBite. Clearing site storage removes it. Guest mode adds fictional ledger
entries so the ranking changes are immediately visible.

## Signed-in mode

Supabase Auth stores an email address. The application stores meal history, comments,
ratings, preferences, and manually entered shift times. Each personal table:

- references the authenticated user with cascading deletion;
- enables RLS;
- has per-operation policies scoped to `auth.uid()`;
- is also queried with an explicit `user_id` filter.

## User controls

- Export creates a local JSON file containing current mode data.
- Delete ledger removes every ledger row in the current mode.
- Delete account clears personal rows and calls an authenticated self-deletion RPC.

## Providers and retention

Cloudflare serves static application files. Supabase provides authentication and
database storage. Application data is retained until deletion; infrastructure backups
may persist for the provider's documented window. A real deployment must link current
provider notices and replace the repository support URL.

This document describes product behavior and is not legal advice.
