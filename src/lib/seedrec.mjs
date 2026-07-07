// seedrec.mjs — deterministic canonical knit/1 record for a seed knit (KW-008 acc.1).
// Shared by tools/sign-seed.mjs (signer) and src/build.mjs (verifier) so the exact
// same bytes are signed and later verified. No clock, no randomness: ts is passed in.
import { authorFromPub } from "./fabric.ts";

/** Build the canonical (unsigned) knit/1 record for one seed knit. */
export function knitRecord(knit, { field, signerPub, ts }) {
  const rec = { type: "knit/1", field };
  if (knit.claim) rec.claim = knit.claim;
  if (knit.source) rec.source = knit.source;
  rec.lang = "nl";
  if (Array.isArray(knit.tags) && knit.tags.length) rec.tags = knit.tags.join(" ");
  rec.author = authorFromPub(signerPub);
  rec.ts = String(ts);
  rec.prev = "-";
  return rec;
}
