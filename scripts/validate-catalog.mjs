import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  await fs.readFile(path.join(root, "data", "generated", "catalog.json"), "utf8")
);
const meta = JSON.parse(
  await fs.readFile(path.join(root, "data", "generated", "catalog-meta.json"), "utf8")
);

const errors = [];
const ids = new Set();
const signatures = new Set();

if (catalog.length !== 296) errors.push(`Expected 296 demo combinations; found ${catalog.length}.`);
if (meta.count !== catalog.length) errors.push("Metadata count does not match catalogue length.");
if (meta.schemaVersion !== 1) errors.push("Unexpected catalogue schema version.");

for (const meal of catalog) {
  if (ids.has(meal.id)) errors.push(`Duplicate id: ${meal.id}`);
  ids.add(meal.id);
  if (signatures.has(meal.signature)) errors.push(`Duplicate signature: ${meal.signature}`);
  signatures.add(meal.signature);

  const sortedIds = meal.additions.map((addition) => addition.id).sort();
  const expectedSignature = `${meal.id.split("-").slice(1, -1).join("-")}::${sortedIds.join("|")}`;
  if (meal.signature !== expectedSignature) {
    errors.push(`Non-canonical signature: ${meal.id}`);
  }
  if (meal.baseScore < 0 || meal.baseScore > 10) errors.push(`Score outside 0–10: ${meal.id}`);
  if (meal.heaviness < 0 || meal.heaviness > 10) {
    errors.push(`Heaviness outside 0–10: ${meal.id}`);
  }
  if (!meal.additions.length) errors.push(`Meal has no additions: ${meal.id}`);
}

if (errors.length) {
  console.error(errors.slice(0, 20).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${catalog.length} combinations with unique IDs and signatures.`);
}
