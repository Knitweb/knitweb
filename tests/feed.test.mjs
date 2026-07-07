import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseChangelog, feedFromChangelog } from "../src/lib/feed.mjs";

test("feed: parseert bullets + issue-refs verbatim", () => {
  const md = "# Changelog\n\n- KW-009: CI (#9) en meer (#25).\n- KW-008: ingest.\nnon-bullet regel\n";
  const e = parseChangelog(md);
  assert.equal(e.length, 2);
  assert.deepEqual(e[0].refs, [9, 25]);
  assert.equal(e[1].text, "KW-008: ingest.");
  assert.deepEqual(e[1].refs, []);
});

test("feed: feedFromChangelog respecteert limit + versie", () => {
  const md = Array.from({ length: 30 }, (_, i) => `- entry ${i}`).join("\n");
  const f = feedFromChangelog(md, { limit: 5 });
  assert.equal(f.version, 1);
  assert.equal(f.entries.length, 5);
});

test("feed: echte CHANGELOG.md levert geldige entries", () => {
  const md = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  const f = feedFromChangelog(md);
  assert.ok(f.entries.length >= 5, "verwacht ≥5 devlog-entries");
  assert.ok(f.entries.every((e) => typeof e.text === "string" && Array.isArray(e.refs)));
});
