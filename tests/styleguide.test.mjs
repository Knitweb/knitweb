// styleguide.test.mjs — KW-003 designtokens + componenten (visueel; hier de harde checks).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("build levert dist/tokens.css + dist/styleguide.html", () => {
  // eigen output-dir (KNITWEB_DIST) zodat parallelle test-builds niet racen op dist/
  const out = mkdtempSync(join(tmpdir(), "kw-dist-"));
  execFileSync("node", [join(ROOT, "src", "build.mjs")], { cwd: ROOT, env: { ...process.env, KNITWEB_DIST: out } });
  assert.ok(existsSync(join(out, "tokens.css")), "tokens.css moet mee-gekopieerd zijn");
  assert.ok(existsSync(join(out, "styleguide.html")), "styleguide.html moet mee-gekopieerd zijn");
});

test("tokens.css bevat alle componentklassen (§AC2) en geen framework-import", () => {
  const css = readFileSync(join(ROOT, "static", "tokens.css"), "utf8");
  for (const c of ["field-card", "knit-card", "vote-widget", "hash", "strip", "badge-status"]) {
    assert.match(css, new RegExp("\\." + c + "\\b"), `.${c} ontbreekt`);
  }
  assert.match(css, /prefers-reduced-motion/, "prefers-reduced-motion moet gerespecteerd worden");
  assert.doesNotMatch(css, /@import/, "geen CSS-framework/@import");
});

test("styleguide toont drie accents", () => {
  const html = readFileSync(join(ROOT, "static", "styleguide.html"), "utf8");
  for (const accent of ["#3fb6a8", "#f4b41a", "#d4a017"]) {
    assert.ok(html.includes(`--accent:${accent}`), `styleguide mist accent ${accent}`);
  }
});
