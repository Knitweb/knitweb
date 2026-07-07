// sign-seed.mjs — sign a field's seed knits with the offline curator key.
// Reads ~/.knitweb-curator/<slug>.key, sets seed.signer + per-knit sig/rid in place.
// Usage: node tools/sign-seed.mjs <field-slug>
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { knitRecord } from "../src/lib/seedrec.mjs";
import { signRecord, authorFromPriv } from "../src/lib/fabric.ts";

const slug = process.argv[2];
if (!slug) { console.error("usage: node tools/sign-seed.mjs <field-slug>"); process.exit(1); }
const keyfile = join(homedir(), ".knitweb-curator", `${slug}.key`);
if (!existsSync(keyfile)) {
  console.error(`geen curator-key: ${keyfile}\nmaak er een met:  node tools/curator-key.mjs ${slug}`);
  process.exit(1);
}
const priv = hexToBytes((await readFile(keyfile, "utf8")).trim());
const pub = bytesToHex(secp256k1.getPublicKey(priv, true));
const seedPath = join("seeds", `${slug}.knits.json`);
const seed = JSON.parse(await readFile(seedPath, "utf8"));
seed.signer = pub;
const ts = seed.ts || 1751500000000; // frozen: reproducible builds, no clock
seed.ts = ts;
for (const k of seed.knits) {
  const rec = knitRecord(k, { field: seed.field, signerPub: pub, ts });
  signRecord(rec, priv); // sets author, sig, id
  k.sig = rec.sig;
  k.rid = rec.id;
}
await writeFile(seedPath, JSON.stringify(seed, null, 2) + "\n", "utf8");
console.log(`✓ ${seed.knits.length} knits ondertekend — author ${authorFromPriv(priv)}, signer ${pub.slice(0, 16)}…`);
