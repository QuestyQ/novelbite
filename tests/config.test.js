import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8"));
const index = await fs.readFile(new URL("../index.html", import.meta.url), "utf8");
const configWriter = await fs.readFile(new URL("../scripts/write-public-config.mjs", import.meta.url), "utf8");

test("local and production builds generate browser configuration", () => {
  assert.match(packageJson.scripts.prebuild, /config:write/);
  assert.match(packageJson.scripts.predev, /config:write/);
  assert.match(configWriter, /public\/config\.js/);
  assert.match(index, /<script src="\/config\.js"><\/script>/);
});


test("production runtime does not depend on Vite import.meta environment replacement", async () => {
  const main = await fs.readFile(new URL("../src/app/main.js", import.meta.url), "utf8");
  assert.doesNotMatch(main, /import\.meta\.env/);
  assert.match(main, /navigator\.serviceWorker\.register/);
});
