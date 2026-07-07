// curator-key.mjs — generate an OFFLINE field-curator keypair.
// The private key is written to ~/.knitweb-curator/<slug>.key (chmod 600) and
// MUST NEVER be committed or uploaded. Only the public key goes into the seed.
// Usage: node tools/curator-key.mjs <field-slug>
import { mkdir, writeFile, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex } from "@noble/hashes/utils";
import { authorFromPub } from "../src/lib/fabric.ts";

const slug = process.argv[2] || "curator";
const dir = join(homedir(), ".knitweb-curator");
const keyfile = join(dir, `${slug}.key`);
if (existsSync(keyfile)) { console.error(`bestaat al (niet overschreven): ${keyfile}`); process.exit(1); }
await mkdir(dir, { recursive: true });
const priv = secp256k1.utils.randomPrivateKey();
await writeFile(keyfile, bytesToHex(priv) + "\n", { mode: 0o600 });
await chmod(keyfile, 0o600);
const pub = bytesToHex(secp256k1.getPublicKey(priv, true));
console.log(`curator-key → ${keyfile} (offline, chmod 600)`);
console.log(`signer (pub): ${pub}`);
console.log(`author:       ${authorFromPub(pub)}`);
console.log(`\nZet in seeds/${slug}.knits.json:  "signer": "${pub}"  en teken met:  node tools/sign-seed.mjs ${slug}`);
