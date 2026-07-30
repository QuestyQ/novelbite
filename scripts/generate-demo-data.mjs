import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import writeXlsxFile from "write-excel-file/node";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const blueprintPath = path.join(root, "data", "sample", "menu-blueprint.json");
const workbookPath = path.join(root, "data", "sample", "novelbite-demo.xlsx");
const blueprint = JSON.parse(await fs.readFile(blueprintPath, "utf8"));

const headerStyle = {
  fontWeight: "bold",
  color: "#FFFFFF",
  backgroundColor: "#12324A"
};

function cell(value, style = {}) {
  const type =
    typeof value === "number" ? Number : typeof value === "boolean" ? Boolean : String;
  return { value, type, ...style };
}

function objectRows(headers, objects, valueForHeader) {
  return [
    headers.map((header) => cell(header, headerStyle)),
    ...objects.map((object) => headers.map((header) => cell(valueForHeader(object, header))))
  ];
}

const dishHeaders = [
  "id",
  "name",
  "category",
  "style",
  "repetition_family",
  "addition_group",
  "min_additions",
  "max_additions",
  "base_score",
  "base_heaviness"
];
const dishKeys = {
  repetition_family: "repetitionFamily",
  addition_group: "additionGroup",
  min_additions: "minAdditions",
  max_additions: "maxAdditions",
  base_score: "baseScore",
  base_heaviness: "baseHeaviness"
};
const additionHeaders = [
  "id",
  "name",
  "group",
  "novelty",
  "heaviness",
  "natural",
  "contains_egg"
];

const dishRows = objectRows(
  dishHeaders,
  blueprint.dishes,
  (dish, header) => dish[dishKeys[header] || header]
);
const additionRows = objectRows(
  additionHeaders,
  blueprint.additions,
  (addition, header) => addition[header === "contains_egg" ? "containsEgg" : header]
);
const noteRows = [
  [cell("NovelBite fictional demo workbook", { fontWeight: "bold" })],
  [cell("This workbook is generated, anonymised, and safe to publish.")],
  [cell("Pipeline: workbook -> validation -> combinations -> deduplication -> scoring -> JSON.")],
  [cell("The private 5,275-combination catalogue from the original app is not included.")],
  [cell(`Schema version: ${blueprint.schemaVersion}`)]
];

await fs.mkdir(path.dirname(workbookPath), { recursive: true });
await writeXlsxFile(
  [
    {
      data: dishRows,
      sheet: "Dishes",
      stickyRowsCount: 1,
      columns: dishHeaders.map(() => ({ width: 20 }))
    },
    {
      data: additionRows,
      sheet: "Additions",
      stickyRowsCount: 1,
      columns: additionHeaders.map(() => ({ width: 18 }))
    },
    {
      data: noteRows,
      sheet: "README",
      columns: [{ width: 100 }]
    }
  ],
  { fontFamily: "Arial", fontSize: 10 }
).toFile(workbookPath);

console.log(`Wrote ${path.relative(root, workbookPath)}`);
