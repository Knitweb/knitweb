// score.test.mjs — vote/1-aggregatie + score-engine (SPEC §A5, KW-007).
import { test } from "node:test";
import assert from "node:assert/strict";
import { score, scoreOf } from "../src/lib/score.ts";

// hulpje: maak een vote/1-record
let _n = 0;
const vote = (on, dir, author, ts, id) => ({
  type: "vote/1", on, dir, author, ts: String(ts),
  id: id ?? `id${String(_n++).padStart(6, "0")}`,
});

// ── AC1 · LWW per (author,on), ts-tiebreak op id (beide paden) ──────────────
test("LWW: laatste ts wint — één auteur telt maar één keer", () => {
  const recs = [
    vote("knit:x", "up", "alice", 1),
    vote("knit:x", "down", "alice", 5), // latere ts → deze wint
  ];
  const t = scoreOf(recs, "knit:x");
  assert.deepEqual({ up: t.up, down: t.down, score: t.score, total: t.total },
    { up: 0, down: 1, score: -1, total: 1 });
});

test("LWW-tiebreak: gelijke ts → laagste id wint", () => {
  const recs = [
    vote("knit:x", "up", "bob", 5, "id-bbb"),
    vote("knit:x", "down", "bob", 5, "id-aaa"), // gelijke ts, lagere id → wint
  ];
  const t = scoreOf(recs, "knit:x");
  assert.equal(t.down, 1);
  assert.equal(t.up, 0);
  // en andersom: hogere id verliest
  const recs2 = [
    vote("knit:y", "down", "bob", 5, "id-zzz"),
    vote("knit:y", "up", "bob", 5, "id-aaa"), // lagere id → up wint
  ];
  assert.equal(scoreOf(recs2, "knit:y").up, 1);
});

// ── AC2 · betwist-drempel randgevallen (7 vs 8, ratio exact 0,25) ──────────
function votes(on, up, down) {
  const r = [];
  let k = 0;
  for (let i = 0; i < up; i++) r.push(vote(on, "up", `up${k++}`, 1));
  for (let i = 0; i < down; i++) r.push(vote(on, "down", `dn${k++}`, 1));
  return r;
}

test("betwist: 8 stemmen met ratio exact 0,25 is betwist", () => {
  const t = scoreOf(votes("knit:a", 6, 2), "knit:a"); // 2/8 = 0,25
  assert.equal(t.total, 8);
  assert.equal(t.betwist, true);
});

test("betwist: 7 stemmen is nooit betwist (totaal < 8)", () => {
  const t = scoreOf(votes("knit:b", 5, 2), "knit:b"); // 2/7 ≈ 0,286 maar totaal 7
  assert.equal(t.total, 7);
  assert.equal(t.betwist, false);
});

test("betwist: ratio net onder 0,25 bij 8 stemmen is niet betwist", () => {
  const t = scoreOf(votes("knit:c", 7, 1), "knit:c"); // 1/8 = 0,125
  assert.equal(t.betwist, false);
  assert.equal(t.score, 6);
});

// ── AC3 · property: permutatie van volgorde verandert de uitkomst nooit ────
function mulberry32(a) { return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const norm = (m) => [...m.values()].map(t => ({ ...t })).sort((a, b) => a.on < b.on ? -1 : 1);

test("property: elke permutatie van records geeft dezelfde tally", () => {
  const rnd = mulberry32(7);
  const base = [];
  for (let i = 0; i < 300; i++) {
    const on = `knit:${Math.floor(rnd() * 10)}`;
    const author = `a${Math.floor(rnd() * 40)}`;      // botsingen → LWW-paden
    const dir = rnd() < 0.5 ? "up" : "down";
    const ts = 1 + Math.floor(rnd() * 5);              // gelijke ts → id-tiebreak
    base.push(vote(on, dir, author, ts));
  }
  const expected = norm(score(base));
  for (let trial = 0; trial < 20; trial++) {
    const shuffled = base.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    assert.deepEqual(norm(score(shuffled)), expected, `permutatie ${trial} wijkt af`);
  }
});

// ── AC4 · benchmark: 10k votes < 50 ms ──────────────────────────────────────
test("benchmark: 10k votes < 50 ms", () => {
  const recs = [];
  for (let i = 0; i < 10000; i++) {
    recs.push(vote(`knit:${i % 200}`, i % 3 === 0 ? "down" : "up", `author${i}`, 1 + (i % 7)));
  }
  const t0 = performance.now();
  const res = score(recs);
  const dt = performance.now() - t0;
  assert.ok(res.size === 200, `verwacht 200 targets, kreeg ${res.size}`);
  assert.ok(dt < 50, `score() duurde ${dt.toFixed(1)} ms (drempel 50 ms)`);
});
