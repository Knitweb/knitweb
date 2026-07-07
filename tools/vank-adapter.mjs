// vank-adapter.mjs — parse a vank.report.v1 JSON → CONCEPT knits into seeds/_drafts/.
// Drafts are NOT signed and NOT auto-ingested; each is marked CURATIE-VEREIST for a
// human to check before it ever becomes a real seed. We only mechanically restate the
// report's own measurement/mint fields — no chemical claim is invented here.
// Usage: node tools/vank-adapter.mjs <report.json> [--field <slug>]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

class AdapterError extends Error {}

const slugify = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "onbekend";

export function draftsFromReport(report, field = "chemfield") {
  if (!report || typeof report !== "object") throw new AdapterError("report is geen object");
  if (report.format !== "vank.report.v1") throw new AdapterError(`onbekend formaat: ${report.format} (verwacht vank.report.v1)`);
  if (!report.producer) throw new AdapterError("report mist 'producer'");
  if (!Array.isArray(report.events)) throw new AdapterError("report.events moet een array zijn");
  const knits = [];
  for (const [i, ev] of report.events.entries()) {
    if (!ev || typeof ev !== "object") throw new AdapterError(`events[${i}] is geen object`);
    if (!ev.id) throw new AdapterError(`events[${i}] mist 'id'`);
    const m = ev.measurement;
    if (!m) continue; // alleen events met een meting worden een concept-knit
    const claim = `${report.producer}: ${m.quantity ?? "grootheid"} = ${m.value ?? "?"}${m.unit ? " " + m.unit : ""}` +
      (m.method ? ` (methode: ${m.method})` : "");
    knits.push({
      id: `draft-${slugify(report.producer)}-${slugify(ev.id)}`,
      claim,                                   // mechanische herformulering van de report-velden
      tags: [report.producer, report.grant, m.quantity].filter(Boolean).map(slugify),
      source: `vank:${ev.id}`,                 // acceptatie 2
      score: 0,
      curatie: "VEREIST",                      // nooit auto-ingested; mens cureert
      mint: ev.mint ?? null,
    });
  }
  return { field, source: "vank.report.v1", producer: report.producer, curatie: "VEREIST", knits, fibers: [] };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const fieldIdx = args.indexOf("--field");
  const field = fieldIdx >= 0 ? args[fieldIdx + 1] : "chemfield";
  const path = args.find((a) => !a.startsWith("--") && a !== field);
  if (!path) { console.error("usage: node tools/vank-adapter.mjs <report.json> [--field <slug>]"); process.exit(1); }
  let report;
  try {
    report = JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    console.error(`✗ vank-report onleesbaar (${path}): ${e.message}`); process.exit(1); // acceptatie 4
  }
  let out;
  try {
    out = draftsFromReport(report, field);
  } catch (e) {
    console.error(`✗ ongeldige vank.report.v1: ${e.message}`); process.exit(1); // acceptatie 4
  }
  const dir = join("seeds", "_drafts");
  await mkdir(dir, { recursive: true });
  const dst = join(dir, `${slugify(out.producer)}.drafts.json`);
  await writeFile(dst, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`✓ ${out.knits.length} concept-knit(s) → ${dst}`);
  console.log(`\nCURATIE-VEREIST-checklist (voor Edwin):`);
  for (const k of out.knits) console.log(`  [ ] ${k.source} — ${k.claim}`);
  console.log(`\nGeen auto-signeren: cureer, verplaats naar seeds/${field}.knits.json en teken met tools/sign-seed.mjs.`);
}

export { AdapterError };
