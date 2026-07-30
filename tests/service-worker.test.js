import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(
  await fs.readFile(new URL("../package.json", import.meta.url), "utf8")
);
const serviceWorker = await fs.readFile(
  new URL("../public/sw.js", import.meta.url),
  "utf8"
);

test("service-worker cache is tied to each package release", () => {
  assert.match(serviceWorker, new RegExp(`APP_VERSION = "${packageJson.version}"`));
  assert.match(serviceWorker, /novelbite-shell-v\$\{APP_VERSION\}/);
  assert.match(serviceWorker, /caches\.delete/);
});
