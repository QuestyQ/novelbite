import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSheet } from "read-excel-file/node";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workbookPath = path.join(root, "data", "sample", "novelbite-demo.xlsx");
const generatedDirectory = path.join(root, "data", "generated");
const publicDirectory = path.join(root, "public", "data");

function rowsAsObjects(rows) {
  const [headers, ...values] = rows;
  return values
    .filter((row) => row.some((value) => value !== null))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [String(header), row[index]]))
    );
}

function combinations(values, size, start = 0, prefix = [], result = []) {
  if (prefix.length === size) {
    result.push(prefix);
    return result;
  }
  for (let index = start; index <= values.length - (size - prefix.length); index += 1) {
    combinations(values, size, index + 1, [...prefix, values[index]], result);
  }
  return result;
}

function round(value, precision = 2) {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function booleanValue(value) {
  return value === true || value === 1 || String(value).toLowerCase() === "true";
}

function canonicalSignature(dish, additions) {
  return `${dish.id}::${additions.map((addition) => addition.id).sort().join("|")}`;
}

function scoreCombination(dish, additions) {
  const novelty = additions.reduce((sum, item) => sum + Number(item.novelty), 0) / additions.length;
  const additionWeight = additions.reduce((sum, item) => sum + Number(item.heaviness), 0);
  const heaviness = Math.min(10, Number(dish.base_heaviness) + additionWeight * 0.72);
  const naturalRatio = additions.filter((item) => item.natural).length / additions.length;
  const balance = 10 - Math.abs(5.8 - heaviness);
  const baseScore =
    Number(dish.base_score) + novelty * 0.13 + balance * 0.06 + naturalRatio * 0.18;
  return {
    novelty: round(novelty),
    heaviness: round(heaviness),
    baseScore: round(Math.min(9.8, baseScore))
  };
}

const workbookBuffer = await fs.readFile(workbookPath);
const workbookHash = crypto.createHash("sha256").update(workbookBuffer).digest("hex");
const dishes = rowsAsObjects(await readSheet(workbookBuffer, "Dishes"));
const additions = rowsAsObjects(await readSheet(workbookBuffer, "Additions")).map((addition) => ({
  ...addition,
  novelty: Number(addition.novelty),
  heaviness: Number(addition.heaviness),
  natural: booleanValue(addition.natural),
  containsEgg: booleanValue(addition.contains_egg)
}));

const catalog = [];
const seen = new Set();

for (const dish of dishes) {
  const compatible = additions.filter((addition) => addition.group === dish.addition_group);
  let sequence = 1;
  for (let size = Number(dish.min_additions); size <= Number(dish.max_additions); size += 1) {
    for (const selection of combinations(compatible, size)) {
      const signature = canonicalSignature(dish, selection);
      if (seen.has(signature)) continue;
      seen.add(signature);
      const scores = scoreCombination(dish, selection);
      catalog.push({
        id: `NB-${dish.id}-${String(sequence).padStart(3, "0")}`,
        name: dish.name,
        category: dish.category,
        style: dish.style,
        repetitionFamily: dish.repetition_family,
        additions: selection.map((addition) => ({
          id: addition.id,
          name: addition.name,
          natural: addition.natural,
          containsEgg: addition.containsEgg
        })),
        signature,
        novelty: scores.novelty,
        heaviness: scores.heaviness,
        baseScore: scores.baseScore,
        catalogueSchemaVersion: 1
      });
      sequence += 1;
    }
  }
}

catalog.sort((left, right) => left.id.localeCompare(right.id));

const columns = [
  "id",
  "name",
  "category",
  "style",
  "repetitionFamily",
  "additions",
  "signature",
  "novelty",
  "heaviness",
  "baseScore",
  "catalogueSchemaVersion"
];
const packed = {
  schemaVersion: 1,
  columns,
  rows: catalog.map((meal) => columns.map((column) => meal[column]))
};
const meta = {
  appVersion: "1.0.0",
  schemaVersion: 1,
  recommendationEngineVersion: "1.0.0",
  count: catalog.length,
  sourceWorkbook: "data/sample/novelbite-demo.xlsx",
  sourceWorkbookSha256: workbookHash,
  generatedBy: "scripts/excel-to-json.mjs",
  generatedAt: "deterministic-build",
  disclaimer: "Fictional portfolio-safe data; no production menu or personal data."
};

await Promise.all([
  fs.mkdir(generatedDirectory, { recursive: true }),
  fs.mkdir(publicDirectory, { recursive: true })
]);
await Promise.all([
  fs.writeFile(path.join(generatedDirectory, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`),
  fs.writeFile(path.join(generatedDirectory, "catalog.packed.json"), `${JSON.stringify(packed)}\n`),
  fs.writeFile(path.join(generatedDirectory, "catalog-meta.json"), `${JSON.stringify(meta, null, 2)}\n`),
  fs.writeFile(path.join(publicDirectory, "catalog.json"), `${JSON.stringify(catalog)}\n`),
  fs.writeFile(path.join(publicDirectory, "catalog-meta.json"), `${JSON.stringify(meta)}\n`)
]);

console.log(`Generated ${catalog.length} unique combinations.`);
console.log(`Workbook SHA-256: ${workbookHash}`);
