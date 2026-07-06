// fabric.ts — knit/1, fiber/1, vote/1: canonicalisatie, keccak256, secp256k1 (SPEC §A4).
//
// Line-based UTF-8 records (DYAD-familie). De regels hieronder zijn HARD; de golden
// vectors in de tests bevriezen de bytes vanaf merge. Geen JSON-vorm van records —
// de line-based tekst is de bron van waarheid.
import { keccak_256 } from "@noble/hashes/sha3";
import { secp256k1 } from "@noble/curves/secp256k1";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";

export type RecordType = "knit/1" | "fiber/1" | "vote/1";
export type FabricRecord = Record<string, string> & { type: RecordType };

// Vaste sleutelvolgorde per type (de type-marker is de kale eerste regel; sig/id sluiten af).
const ORDER: Record<RecordType, string[]> = {
  "knit/1": ["field", "claim", "source", "license", "lang", "tags", "author", "ts", "prev"],
  "fiber/1": ["rel", "from", "to", "field", "author", "ts", "prev"],
  "vote/1": ["on", "dir", "author", "ts"],
};
const REQUIRED: Record<RecordType, string[]> = {
  "knit/1": ["field", "claim", "author", "ts"],
  "fiber/1": ["rel", "from", "to", "author", "ts"],
  "vote/1": ["on", "dir", "author", "ts"],
};
const ENUM: Record<string, string[]> = {
  rel: ["supports", "contradicts", "derives", "cites", "links"],
  dir: ["up", "down"],
};

export class FabricError extends Error {}

const isType = (t: string): t is RecordType => t === "knit/1" || t === "fiber/1" || t === "vote/1";

// ── canonicalisatie van één value (§A4.1, §A4.4) ────────────────────────────
// NFC-normaliseren, dan backslash → \\ , dan newline → \n (backslash-n).
export function canon(value: string): string {
  const nfc = value.normalize("NFC");
  if (nfc.includes("\r")) throw new FabricError("value bevat CR (\\r is niet toegestaan)");
  // §A4.2: geen trailing whitespace op regels, en §A4 kent enkel \n/\\ als escapes —
  // een value die op spatie/tab eindigt is dus niet canoniek representeerbaar.
  if (/[ \t]$/.test(nfc)) throw new FabricError("value mag niet eindigen op spatie/tab (§A4.2)");
  return nfc.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}
// Inverse: \n → newline, \\ → backslash (geen andere escapes).
function uncanon(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\") {
      const n = s[++i];
      if (n === "n") out += "\n";
      else if (n === "\\") out += "\\";
      else throw new FabricError(`ongeldige escape \\${n ?? ""}`);
    } else out += s[i];
  }
  return out;
}

// ── serialisatie van de body (type + geordende key-regels, t/m de regel vóór sig:) ──
function bodyLines(rec: FabricRecord): string[] {
  if (!isType(rec.type)) throw new FabricError(`onbekend recordtype: ${rec.type}`);
  for (const k of REQUIRED[rec.type]) {
    if (rec[k] == null || rec[k] === "") throw new FabricError(`${rec.type}: verplicht veld ontbreekt: ${k}`);
  }
  for (const [k, allowed] of Object.entries(ENUM)) {
    if (rec[k] != null && !allowed.includes(rec[k])) {
      throw new FabricError(`${k} moet één van [${allowed.join(", ")}] zijn, kreeg "${rec[k]}"`);
    }
  }
  const lines = [rec.type];
  for (const k of ORDER[rec.type]) {
    // §A4.5: ontbrekend/leeg optioneel veld → regel weglaten (nooit lege value).
    if (rec[k] != null && rec[k] !== "") lines.push(`${k}: ${canon(rec[k])}`); // §A4.3 exact ": "
  }
  return lines;
}

const kdigest = (text: string): string => bytesToHex(keccak_256(utf8ToBytes(text)));

/** Digest (§A4.6): keccak256 over de canonieke bytes t/m de regel vóór `sig:`. */
export function digestOf(rec: FabricRecord): string {
  return kdigest(bodyLines(rec).join("\n"));
}

/** author (§A4.9): eerste 24 hex van keccak256(compressed pubkey). */
export function authorFromPub(pubkey: Uint8Array | string): string {
  const pk = typeof pubkey === "string" ? hexToBytes(pubkey) : pubkey;
  return bytesToHex(keccak_256(pk)).slice(0, 24);
}
export function authorFromPriv(priv: Uint8Array | string): string {
  return authorFromPub(secp256k1.getPublicKey(priv, true));
}

/** Onderteken een record met `priv`: zet author, sig en id (§A4.6–A4.9). Retourneert het record. */
export function signRecord(rec: FabricRecord, priv: Uint8Array | string): FabricRecord {
  rec.author = authorFromPriv(priv);
  const digest = digestOf(rec); // hex van 32 bytes
  const sig = secp256k1.sign(hexToBytes(digest), priv).toCompactHex();
  rec.sig = sig;
  const withSig = [...bodyLines(rec), `sig: ${sig}`];
  rec.id = kdigest(withSig.join("\n")); // §A4.8
  return rec;
}

/** Serialiseer een (reeds getekend) record naar canonieke tekst — geen trailing newline. */
export function serialize(rec: FabricRecord): string {
  const lines = bodyLines(rec);
  if (rec.sig != null) lines.push(`sig: ${canon(rec.sig)}`);
  if (rec.id != null) lines.push(`id: ${canon(rec.id)}`);
  return lines.join("\n");
}

/** Parse canonieke tekst → record. Verwerpt CR, lege regels, trailing whitespace en foute keyvolgorde. */
export function parse(text: string): FabricRecord {
  if (text.includes("\r")) throw new FabricError("CR/CRLF niet toegestaan (§A4.2)");
  if (text.endsWith("\n")) throw new FabricError("bestand eindigt met newline (§A4.2)");
  const lines = text.split("\n");
  const type = lines[0];
  if (!isType(type)) throw new FabricError(`onbekend recordtype op regel 1: ${type}`);
  const rec: FabricRecord = { type };
  const seen: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === "") throw new FabricError(`lege regel ${i + 1} (§A4.2)`);
    if (line !== line.replace(/[ \t]+$/, "")) throw new FabricError(`trailing whitespace op regel ${i + 1} (§A4.2)`);
    const sep = line.indexOf(": ");
    if (sep < 1) throw new FabricError(`regel ${i + 1} mist "key: value" (§A4.3)`);
    const key = line.slice(0, sep);
    if (key !== key.toLowerCase()) throw new FabricError(`key "${key}" moet lowercase (§A4.3)`);
    rec[key] = uncanon(line.slice(sep + 2));
    seen.push(key);
  }
  // volgorde: [ORDER-subsequence] gevolgd door sig, id
  const dataKeys = seen.filter((k) => k !== "sig" && k !== "id");
  const allowed = ORDER[type];
  let p = -1;
  for (const k of dataKeys) {
    const idx = allowed.indexOf(k);
    if (idx < 0) throw new FabricError(`onbekend veld "${k}" voor ${type}`);
    if (idx <= p) throw new FabricError(`veld "${k}" in verkeerde volgorde (§A4.3)`);
    p = idx;
  }
  if (seen[seen.length - 2] !== "sig" || seen[seen.length - 1] !== "id") {
    throw new FabricError("record moet eindigen met sig: dan id: (§A4.6–A4.8)");
  }
  return rec;
}

/** Verifieer een record-tekst tegen een pubkey: id-consistentie + author-binding + geldige sig. */
export function verify(text: string, pubkey: Uint8Array | string): boolean {
  const rec = parse(text);
  const digest = digestOf(rec);
  const withSig = [...bodyLines(rec), `sig: ${rec.sig}`];
  if (rec.id !== kdigest(withSig.join("\n"))) return false; // id klopt niet met de bytes
  if (rec.author !== authorFromPub(pubkey)) return false; // author bindt niet aan pubkey
  return secp256k1.verify(rec.sig, hexToBytes(digest), pubkey);
}
