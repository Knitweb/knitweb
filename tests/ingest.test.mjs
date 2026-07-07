import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { knitRecord } from "../src/lib/seedrec.mjs";
import { serialize, verify } from "../src/lib/fabric.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const seed = JSON.parse(readFileSync(join(ROOT, "seeds", "chemfield.knits.json"), "utf8"));

test("ingest: build vult knits.json + stats.json", () => {
  const out = mkdtempSync(join(tmpdir(), "kw-ingest-"));
  execFileSync("node", ["src/build.mjs"], { cwd: ROOT, env: { ...process.env, KNITWEB_DIST: out } });
  const stats = JSON.parse(readFileSync(join(out, "stats.json"), "utf8"));
  assert.ok(stats.knits > 0 && stats.fibers > 0, "stats.knits/fibers > 0 na ingest");
  const knits = JSON.parse(readFileSync(join(out, "chemfield", "knits.json"), "utf8"));
  assert.ok(knits[0].claim, "een knit heeft een claim");
});

test("ingest acc.1: chemfield-seed is curator-ondertekend en verifieert", () => {
  assert.ok(seed.signer, "seed heeft een signer (pubkey)");
  assert.ok(seed.knits.every((k) => k.sig && k.rid), "elke knit heeft sig + rid");
  for (const k of seed.knits) {
    const rec = knitRecord(k, { field: seed.field, signerPub: seed.signer, ts: seed.ts });
    rec.sig = k.sig; rec.id = k.rid;
    assert.ok(verify(serialize(rec), seed.signer), `knit ${k.id} verifieert`);
  }
});

test("ingest acc.1: gemanipuleerde claim faalt de handtekening", () => {
  const k = seed.knits[0];
  const rec = knitRecord({ ...k, claim: k.claim + " (getampered)" }, { field: seed.field, signerPub: seed.signer, ts: seed.ts });
  rec.sig = k.sig; rec.id = k.rid;
  assert.equal(verify(serialize(rec), seed.signer), false, "gewijzigde claim mag niet verifiëren");
});
