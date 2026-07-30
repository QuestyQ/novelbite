import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { mealSignature } from "../src/recommendations/engine.js";

const catalog = JSON.parse(
  await fs.readFile(new URL("../data/generated/catalog.json", import.meta.url), "utf8")
);

test("portfolio-safe catalogue contains 296 eligible combinations", () => {
  assert.equal(catalog.length, 296);
});

test("all combination IDs and generated signatures are unique", () => {
  assert.equal(new Set(catalog.map((meal) => meal.id)).size, catalog.length);
  assert.equal(new Set(catalog.map((meal) => meal.signature)).size, catalog.length);
});

test("addition order produces the same recommendation signature", () => {
  const meal = catalog.find((candidate) => candidate.additions.length === 3);
  assert.ok(meal);
  assert.equal(
    mealSignature(meal),
    mealSignature({ ...meal, additions: [...meal.additions].reverse() })
  );
});
