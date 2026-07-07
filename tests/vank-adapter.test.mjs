import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { draftsFromReport, AdapterError } from "../tools/vank-adapter.mjs";

const fx = JSON.parse(readFileSync(new URL("../tools/fixtures/vank.report.v1.example.json", import.meta.url), "utf8"));

test("vank-adapter acc.2: drafts dragen source vank:<event-id>", () => {
  const out = draftsFromReport(fx, "chemfield");
  assert.equal(out.knits.length, 2, "alleen events met measurement worden knits");
  assert.ok(out.knits.every((k) => /^vank:evt-/.test(k.source)), "elke draft heeft source vank:<id>");
  assert.ok(out.knits.every((k) => k.curatie === "VEREIST" && !k.sig), "drafts zijn ongetekend + CURATIE-VEREIST");
});

test("vank-adapter acc.4: corrupt/ongeldig report → nette AdapterError", () => {
  assert.throws(() => draftsFromReport({ format: "nope" }), AdapterError);
  assert.throws(() => draftsFromReport({ format: "vank.report.v1", producer: "X" }), AdapterError); // events mist
  assert.throws(() => draftsFromReport(null), AdapterError);
});
