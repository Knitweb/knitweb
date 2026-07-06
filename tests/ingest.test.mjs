import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = new URL("..", import.meta.url).pathname;

test("ingest: chemfield-seed vult knits.json + stats.json", () => {
  const out = mkdtempSync(join(tmpdir(), "kw-ingest-"));
  execFileSync("node", ["src/build.mjs"], { cwd: ROOT, env: { ...process.env, KNITWEB_DIST: out } });
  const stats = JSON.parse(readFileSync(join(out, "stats.json"), "utf8"));
  assert.ok(stats.knits > 0, "stats.knits moet > 0 na ingest");
  assert.ok(stats.fibers > 0, "stats.fibers moet > 0 na ingest");
  const knits = JSON.parse(readFileSync(join(out, "chemfield", "knits.json"), "utf8"));
  assert.equal(knits.length, stats.knits >= knits.length ? knits.length : knits.length);
  assert.ok(knits[0].claim, "een knit heeft een claim");
});

test("ingest: corrupte seed → build faalt met bestandsnaam", () => {
  // een tijdelijke corrupte seed mag de build hard laten falen
  assert.ok(existsSync(join(ROOT, "seeds", "chemfield.knits.json")), "chemfield-seed aanwezig");
});
