import fs from "node:fs";
import path from "node:path";

const failures = [];
const forbiddenTokens = [
  ["YOUR", "_GITHUB_USERNAME"].join(""),
  ["YOUR", "_DEMO_PROJECT_REF"].join(""),
  ["REPLACE", "_ME"].join(""),
  ["Mil", "ano"].join(""),
  ["Min", "ion"].join("")
];
const allowedBinary = new Set([".png", ".xlsx"]);
const self = path.normalize("scripts/release-audit.mjs");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", "dist", ".git"].includes(entry.name)) return [];
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

for (const file of walk(".")) {
  if (path.normalize(file).endsWith(self) || allowedBinary.has(path.extname(file).toLowerCase())) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const token of forbiddenTokens) {
    if (text.includes(token)) failures.push(`${file}: unfinished or private token ${token}`);
  }
  if (/sb_secret_[A-Za-z0-9_-]{8,}/.test(text)) failures.push(`${file}: possible Supabase secret key`);
  if (/sk-[A-Za-z0-9_-]{20,}/.test(text)) failures.push(`${file}: possible secret key`);
}

for (const required of [
  "README.md", "LICENSE", "SECURITY.md", "FIRST_RELEASE.md", ".github/workflows/ci.yml",
  "public/manifest.webmanifest", "public/icons/icon-192.png", "public/icons/icon-512.png",
  "public/icons/apple-touch-icon.png", "wrangler.jsonc"
]) {
  if (!fs.existsSync(required)) failures.push(`Missing ${required}`);
}

if (fs.existsSync("public/_redirects")) failures.push("Remove public/_redirects when Wrangler SPA fallback is enabled.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Release audit passed: no private branding, unfinished tokens or obvious secrets.");
