import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const html = await fs.readFile(new URL("../index.html", import.meta.url), "utf8");
const render = await fs.readFile(new URL("../src/ui/render.js", import.meta.url), "utf8");

test("page has core landmarks and a skip link", () => {
  assert.match(html, /<header\b/i);
  assert.match(html, /<nav\b[^>]*aria-label="Primary"/i);
  assert.match(html, /<main\b[^>]*id="main"/i);
  assert.match(html, /class="skip-link"[^>]*href="#main"/i);
});

test("dialogs have visible labelled close buttons", () => {
  const dialogs = [...html.matchAll(/<dialog\b[\s\S]*?<\/dialog>/gi)].map((match) => match[0]);
  assert.ok(dialogs.length >= 2);
  for (const dialog of dialogs) assert.match(dialog, /<button\b[^>]*aria-label="Close[^\"]*"/i);
});

test("icon-only priority actions are labelled", () => {
  assert.match(render, /aria-label="Reject/);
  assert.match(render, /aria-label="Open/);
});


test("navigation and Escape can close every open dialog", async () => {
  const main = await fs.readFile(new URL("../src/app/main.js", import.meta.url), "utf8");
  assert.match(main, /function closeOpenDialogs/);
  assert.match(main, /event\.key === "Escape"/);
  assert.match(main, /function showPage[\s\S]*closeOpenDialogs\(\)/);
});

test("product functionality appears before case-study copy", () => {
  const discover = html.indexOf('id="discoverPage"');
  const queue = html.indexOf('id="priorityQueue"');
  const caseStudy = html.indexOf('About this MSc portfolio project');
  assert.ok(discover >= 0 && queue > discover);
  assert.ok(caseStudy > queue);
  assert.match(html, /id="searchPage"/);
  assert.match(html, /id="roulettePage"/);
});
