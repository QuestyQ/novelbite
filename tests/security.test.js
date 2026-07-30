import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const migration = await fs.readFile(
  new URL("../supabase/migrations/001_personal_data_schema.sql", import.meta.url),
  "utf8"
);
const cloudClient = await fs.readFile(
  new URL("../src/storage/cloud.js", import.meta.url),
  "utf8"
);
const ledgerStore = await fs.readFile(
  new URL("../src/ledger/store.js", import.meta.url),
  "utf8"
);

for (const table of ["meal_logs", "preferences", "weekly_schedules"]) {
  test(`${table} enables RLS and isolates reads by auth.uid()`, () => {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    assert.match(
      migration,
      new RegExp(
        `on public\\.${table}[\\s\\S]*?for select[\\s\\S]*?auth\\.uid\\(\\) = user_id`,
        "i"
      )
    );
  });
}

test("browser queries explicitly filter personal rows by user_id", () => {
  assert.match(cloudClient, /\.eq\("user_id", userId\)/);
  assert.match(ledgerStore, /\.eq\("user_id", user\.id\)/);
});

test("preferences and weekly schedules have per-user unique constraints", () => {
  assert.match(migration, /unique \(user_id\)/i);
  assert.match(migration, /unique \(user_id, week_start\)/i);
});
