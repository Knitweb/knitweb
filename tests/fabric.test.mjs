// fabric.test.mjs — knit/1, fiber/1, vote/1 (SPEC §A4). Golden vectors zijn bevroren:
// elke wijziging die de hardcoded id/sig/digest breekt is per definitie een spec-breuk.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signRecord, serialize, parse, verify, digestOf, canon, authorFromPriv, FabricError,
} from "../src/lib/fabric.ts";
import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex } from "@noble/hashes/utils";

const PRIV = "0000000000000000000000000000000000000000000000000000000000000001";
const PUB = bytesToHex(secp256k1.getPublicKey(PRIV, true));
const PUB2 = bytesToHex(secp256k1.getPublicKey("0000000000000000000000000000000000000000000000000000000000000002", true));

const knit = () => ({
  type: "knit/1", field: "chemfield",
  claim: "Citroenzuur-leach van BOF-slak haalt 61% V-yield bij pH 2,1 / 40 C",
  source: "xrf:XRF-2026-0421", license: "CC-BY-4.0", lang: "nl", tags: "leaching,vanadium",
  ts: "1751712000000", prev: "-",
});
const fiber = () => ({
  type: "fiber/1", rel: "supports",
  from: "71eb3a4d10036dc74ad9720a03e84abc6ec883b77455ea853dfb1fa76ed6636c",
  to: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
  field: "chemfield", ts: "1751712000000", prev: "-",
});
const vote = () => ({
  type: "vote/1",
  on: "71eb3a4d10036dc74ad9720a03e84abc6ec883b77455ea853dfb1fa76ed6636c",
  dir: "up", ts: "1751712000000",
});

// ── AC4 · GOLDEN VECTORS (bevroren vanaf merge) ─────────────────────────────
const GOLDEN = {
  "knit/1": {
    author: "aa61b794ba668ff67c7b8d03",
    digest: "3f1d1bce66f9f91b8401b31d40157fa275f764063ef1a04a5c82d7ab891d0b6f",
    sig: "0bca2fb80379d28ea6f91ee6130aeb112fb49227ad7806e136db30f08be103452d8ca69023189f05eb54f303b1b803cb7f82aa7f4bd65e09610f28554bf39bbe",
    id: "71eb3a4d10036dc74ad9720a03e84abc6ec883b77455ea853dfb1fa76ed6636c",
  },
  "fiber/1": {
    sig: "c66cb680e6b7634c01b47e9605c23b0e2964bc7157e57a55beb0e0bb254a35ca691befa1d2a39648c9725e331dd4fc450e38643e8aa88caf58caf62acb614324",
    id: "a1a401b6c487c5013bc04661a9d524cd922418a5981c26896d9ef1d08bd9abad",
  },
  "vote/1": {
    sig: "b380a3754e91eaea80aae3aca6d7bff364b920667ef0464d817a56a85304452336ebfc9ceb15cd9efb56569766daa10298f6742ff38e423205c948e6f4380a4b",
    id: "6601e989e1eaa979e0889bbc0e8c2c7a2b9f27bf45b5bbe6b2939e55be4226b0",
  },
};

test("golden vectors: knit/fiber/vote met vaste sleutel+ts zijn byte-stabiel", () => {
  for (const [type, make] of [["knit/1", knit], ["fiber/1", fiber], ["vote/1", vote]]) {
    const r = signRecord(make(), PRIV);
    const g = GOLDEN[type];
    assert.equal(r.id, g.id, `${type} id gewijzigd = spec-breuk`);
    assert.equal(r.sig, g.sig, `${type} sig gewijzigd = spec-breuk`);
    if (g.digest) assert.equal(digestOf(r), g.digest, `${type} digest gewijzigd = spec-breuk`);
    if (g.author) assert.equal(r.author, g.author);
    assert.ok(verify(serialize(r), PUB), `${type} moet verifiëren`);
  }
});

// ── AC1 · round-trip byte-identiek ──────────────────────────────────────────
test("round-trip parse→serialize is byte-identiek (alle 3 types)", () => {
  for (const make of [knit, fiber, vote]) {
    const text = serialize(signRecord(make(), PRIV));
    assert.equal(serialize(parse(text)), text);
  }
});

// ── AC2 · NFC, escaping, volgorde — elk eigen test ──────────────────────────
test("NFC: gedecomponeerde en samengestelde vorm geven identieke digest", () => {
  const a = signRecord({ ...knit(), claim: "café" }, PRIV); // e + combining acute
  const b = signRecord({ ...knit(), claim: "café" }, PRIV);   // é
  assert.equal(digestOf(a), digestOf(b));
  assert.equal(parse(serialize(a)).claim, "café"); // opgeslagen als NFC
});

test("escaping: backslash en newline worden ge-escaped en exact hersteld", () => {
  const claim = "regel1\nregel2 met \\ backslash";
  const text = serialize(signRecord({ ...knit(), claim }, PRIV));
  assert.match(text, /claim: regel1\\nregel2 met \\\\ backslash/); // \n en \\ in de bytes
  assert.equal(parse(text).claim, claim); // exact hersteld
  assert.equal(canon("a\\b\nc"), "a\\\\b\\nc");
});

test("volgorde: CRLF-input faalt", () => {
  const text = serialize(signRecord(knit(), PRIV)).replace(/\n/g, "\r\n");
  assert.throws(() => parse(text), FabricError);
});
test("volgorde: trailing-space faalt", () => {
  const text = serialize(signRecord(knit(), PRIV)).replace("prev: -", "prev: - ");
  assert.throws(() => parse(text), FabricError);
});
test("volgorde: verkeerde keyvolgorde faalt", () => {
  // wissel 'field' en 'claim' om
  const lines = serialize(signRecord(knit(), PRIV)).split("\n");
  [lines[1], lines[2]] = [lines[2], lines[1]];
  assert.throws(() => parse(lines.join("\n")), FabricError);
});
test("lege regel en niet-lowercase key falen", () => {
  const text = serialize(signRecord(knit(), PRIV));
  assert.throws(() => parse(text.replace("lang: nl", "\nlang: nl")), FabricError);
  assert.throws(() => parse(text.replace("field: chemfield", "Field: chemfield")), FabricError);
});

// ── AC3 · sig/verify met vaste sleutel ──────────────────────────────────────
test("sig/verify: geldig record verifieert; verkeerde pubkey en tampering niet", () => {
  const text = serialize(signRecord(knit(), PRIV));
  assert.equal(verify(text, PUB), true);
  assert.equal(verify(text, PUB2), false); // author bindt niet aan andere pubkey
  const tampered = text.replace("61% V-yield", "99% V-yield");
  assert.equal(verify(tampered, PUB), false); // id/sig kloppen niet meer
});

test("author = eerste 24 hex van keccak256(compressed pubkey)", () => {
  assert.equal(authorFromPriv(PRIV), GOLDEN["knit/1"].author);
  assert.equal(authorFromPriv(PRIV).length, 24);
});

// ── AC5 · fuzz: 200 random-value records round-trippen ──────────────────────
function mulberry32(a) { return () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
test("fuzz: 200 random knits round-trippen byte-identiek en verifiëren", () => {
  const rnd = mulberry32(20260706);
  const pool = "abcXYZ 0123,:/.-\n\\éüñ漢🜂";
  // random value, maar géén trailing spatie/tab en niet leeg (niet-representeerbaar, §A4.2/§A4.5)
  const rstr = (n) => { let s = ""; for (let i = 0; i < n; i++) s += pool[Math.floor(rnd() * pool.length)]; return s.replace(/[ \t]+$/, "") || "x"; };
  for (let i = 0; i < 200; i++) {
    const rec = { type: "knit/1", field: "chemfield", claim: rstr(1 + Math.floor(rnd() * 40)),
      tags: rstr(1 + Math.floor(rnd() * 12)), ts: String(1700000000000 + i), prev: "-" };
    const text = serialize(signRecord(rec, PRIV));
    assert.equal(serialize(parse(text)), text, `fuzz #${i} round-trip`);
    assert.equal(verify(text, PUB), true, `fuzz #${i} verify`);
  }
});
