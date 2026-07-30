import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { buildMealQueue } from "../src/recommendations/engine.js";

const catalog = JSON.parse(fs.readFileSync("data/generated/catalog.json", "utf8"));
const history = catalog.slice(0, 24).map((meal, index) => ({
  ...meal,
  mealId: meal.id,
  mealName: meal.name,
  rating: 3 + (index % 3),
  eatenAt: new Date(Date.now() - index * 86_400_000).toISOString()
}));
const context = { shiftHours: 9, goal: "novelty", serviceMoment: "break", naturalOnly: false };

for (let i = 0; i < 20; i += 1) buildMealQueue(catalog, context, history, 5);
const runs = 250;
const started = performance.now();
for (let i = 0; i < runs; i += 1) buildMealQueue(catalog, context, history, 5);
const elapsed = performance.now() - started;
const average = elapsed / runs;
console.log(`Ranking benchmark: ${average.toFixed(3)} ms average across ${runs} runs (${catalog.length} combinations).`);
if (average > 75) {
  console.error("Ranking benchmark exceeded the 75 ms release budget.");
  process.exit(1);
}
