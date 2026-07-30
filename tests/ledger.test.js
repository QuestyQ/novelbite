import assert from "node:assert/strict";
import test from "node:test";
import { LedgerStore } from "../src/ledger/store.js";
import { createMemoryStorage } from "../src/storage/local.js";

test("ledger comments survive save and load", async () => {
  const storage = createMemoryStorage();
  const store = new LedgerStore({ storage });
  await store.add({
    mealId: "NB-TEST-001",
    mealName: "Test Bowl",
    category: "Bowl",
    repetitionFamily: "test-bowl",
    additions: [{ name: "Beetroot" }],
    rating: 5,
    comment: "Keep the crunch."
  });
  const [loaded] = await store.list();
  assert.equal(loaded.comment, "Keep the crunch.");
});
