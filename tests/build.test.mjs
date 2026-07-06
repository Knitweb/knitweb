// build.test.mjs — build smoketests (SPEC §A6). Uses node:test (no test dep).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = join(ROOT, "src", "build.mjs");
const DIST = join(ROOT, "dist");
const FIELDS = join(ROOT, "fields");

function runBuild() {
  return execFileSync("node", [BUILD], { cwd: ROOT, encoding: "utf8" });
}

test("build produces dist/index.html with the configured live field", () => {
  runBuild();
  const index = join(DIST, "index.html");
  assert.ok(existsSync(index), "dist/index.html moet bestaan");
  const html = readFileSync(index, "utf8");
  assert.match(html, /ChemField/i, "hub moet het live chemfield-portaal tonen");
  assert.ok(existsSync(join(DIST, "tokens.css")), "static/tokens.css moet mee-gekopieerd zijn");
});

test("build fails hard (exit != 0) on an invalid field.json", () => {
  const bad = join(FIELDS, "_invalid.field.json");
  writeFileSync(bad, "{ this is not valid json ", "utf8");
  try {
    assert.throws(
      () => execFileSync("node", [BUILD], { cwd: ROOT, stdio: "pipe" }),
      (err) => err.status !== 0,
      "build hoort met exit != 0 te falen bij ongeldige field.json"
    );
  } finally {
    rmSync(bad, { force: true });
  }
  // repo builds cleanly again after the bad file is gone
  runBuild();
  assert.ok(existsSync(join(DIST, "index.html")));
});
