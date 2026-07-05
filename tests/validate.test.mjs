// validate.test.mjs — field.schema.json + validator (KW-002, SPEC §A3).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateField } from "../src/lib/validate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA = JSON.parse(readFileSync(join(ROOT, "field.schema.json"), "utf8"));
const FIELDS = join(ROOT, "fields");

const BASE = {
  slug: "chemfield", name: "ChemField", accent: "#3fb6a8",
  tagline: "Getekende scheikunde-feiten.", status: "live", order: 0,
};

test("alle 6 field-fixtures valideren groen", () => {
  const files = readdirSync(FIELDS).filter((f) => f.endsWith(".field.json"));
  assert.equal(files.length, 6, "verwacht 6 field-fixtures");
  for (const f of files) {
    const cfg = JSON.parse(readFileSync(join(FIELDS, f), "utf8"));
    const errs = validateField(cfg, SCHEMA);
    assert.deepEqual(errs, [], `${f} moet groen valideren, kreeg: ${errs.join(" | ")}`);
  }
});

test("een geldige minimale config valideert groen", () => {
  assert.deepEqual(validateField(BASE, SCHEMA), []);
});

// ── ≥6 gerichte ongeldige gevallen (fout wijst pad+veld aan) ──────────────
const cases = [
  ["fout slug-patroon", { ...BASE, slug: "1bad" }, /^slug: voldoet niet aan patroon/],
  ["ontbrekend accent", (() => { const c = { ...BASE }; delete c.accent; return c; })(), /^accent: verplicht veld ontbreekt/],
  ["onbekende key", { ...BASE, foo: 1 }, /^foo: onbekend veld/],
  ["fout status-enum", { ...BASE, status: "draft" }, /^status: moet één van/],
  ["order negatief", { ...BASE, order: -1 }, /^order: moet ≥ 0 zijn/],
  ["tagline te lang", { ...BASE, tagline: "x".repeat(121) }, /^tagline: te lang/],
  ["fout ingest-type", { ...BASE, ingest: [{ type: "twitter" }] }, /^ingest\[0\]\.type: moet één van/],
  ["accent zonder #", { ...BASE, accent: "3fb6a8" }, /^accent: voldoet niet aan patroon/],
];

for (const [naam, cfg, re] of cases) {
  test(`ongeldig: ${naam}`, () => {
    const errs = validateField(cfg, SCHEMA);
    assert.ok(errs.length >= 1, `${naam} hoort minstens 1 fout te geven`);
    assert.ok(errs.some((e) => re.test(e)), `${naam}: verwacht ${re}, kreeg: ${errs.join(" | ")}`);
  });
}
