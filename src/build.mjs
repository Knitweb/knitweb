#!/usr/bin/env node
// build.mjs — SSG build pipeline (SPEC §A1–A2, §A6).
// Reads fields/ (+ seeds/ later) → dist/. No framework, no CSS-lib.
// Fails hard (exit != 0) with a readable error on an invalid field config.
import { readdir, readFile, mkdir, rm, cp, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateField } from "./lib/validate.mjs";
import { knitRecord } from "./lib/seedrec.mjs";
import { serialize, verify } from "./lib/fabric.ts";
import { feedFromChangelog } from "./lib/feed.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIELDS = join(ROOT, "fields");
const STATIC = join(ROOT, "static");
const CLIENT = join(ROOT, "src", "client");
// Output dir: default dist/, override met KNITWEB_DIST (bv. voor geïsoleerde test-builds).
const DIST = process.env.KNITWEB_DIST ? resolve(process.env.KNITWEB_DIST) : join(ROOT, "dist");
const SCHEMA_PATH = join(ROOT, "field.schema.json");
// Base-path prefix voor alle absolute asset-/pagina-URLs. Leeg (root) by default;
// zet KNITWEB_BASE=knitweb om onder een project-subpad te deployen (bv.
// knitweb.github.io/knitweb/) zonder dode links. Genormaliseerd naar "/<pad>" of "".
const BASE = process.env.KNITWEB_BASE
  ? "/" + process.env.KNITWEB_BASE.replace(/^\/+|\/+$/g, "")
  : "";

class BuildError extends Error {}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function loadFields() {
  if (!existsSync(FIELDS)) return [];
  const schema = JSON.parse(await readFile(SCHEMA_PATH, "utf8"));
  const files = (await readdir(FIELDS)).filter((f) => f.endsWith(".field.json")).sort();
  const fields = [];
  for (const file of files) {
    const path = join(FIELDS, file);
    let cfg;
    try {
      cfg = JSON.parse(await readFile(path, "utf8"));
    } catch (e) {
      throw new BuildError(`${file}: ongeldige JSON — ${e.message}`);
    }
    const errs = validateField(cfg, schema); // volledige §A3-validatie (KW-002)
    if (errs.length) {
      throw new BuildError(`${file}:\n  - ${errs.join("\n  - ")}`);
    }
    fields.push(cfg);
  }
  fields.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  return fields;
}

// Wire esbuild into the pipeline: bundle any src/client/*.ts → dist/*.js.
// esbuild is the single dev-dep; if it is somehow absent we warn and continue,
// so a checkout without node_modules still produces a valid dist/.
async function bundleClient() {
  if (!existsSync(CLIENT)) return;
  const entries = (await readdir(CLIENT)).filter((f) => f.endsWith(".ts"));
  if (entries.length === 0) return;
  let esbuild;
  try {
    esbuild = await import("esbuild");
  } catch {
    console.warn("• esbuild niet geïnstalleerd — client-bundeling overgeslagen (npm i)");
    return;
  }
  await esbuild.build({
    entryPoints: entries.map((f) => join(CLIENT, f)),
    outdir: DIST,
    bundle: true,
    format: "esm",
    target: "es2022",
    minify: true,
    logLevel: "silent",
  });
}

// Footer links are config constants (not hardcoded in markup scattering) — KW-004 (5).
// Footer destinations — every one must resolve (no dead ends on the live hub).
// Decentralised forge mirrors (Radicle/GitLab) run from CI secrets and have no
// public landing to link yet, so they stay out of the footer until they do.
const HUB_LINKS = [
  ["GitHub", "https://github.com/Knitweb"],
  ["Whitepaper", "https://knitweb.github.io"],
  ["Spec v0.1", "https://github.com/Knitweb/knitweb/blob/main/docs/SPEC-v0.1.md"],
  ["Live node · 5mart.ml", "https://5mart.ml"],
];

// The hub (wireframe §2.1): hero + live fabric-strip (stats.json) + field-grid
// (order-sorted, hidden filtered, teaser badged) + explorer-teaser (client search
// over each field's knits.json). One small module bundle (/hub.js), zero external
// origins. KW-004 (5).
function renderHub(fields) {
  const shown = fields.filter((f) => f.status !== "hidden");
  const cards = shown
    .map(
      (f) => `      <a class="field-card ${esc(f.status)}" href="${BASE}/${esc(f.slug)}/" style="--accent:${esc(f.accent)}">
        <span class="badge">${esc(f.status)}</span>
        <h2>${esc(f.name)}</h2>
        <p>${esc(f.tagline)}</p>
      </a>`
    )
    .join("\n");
  const empty = `      <p class="empty">Nog geen fields geconfigureerd. Voeg een <code>*.field.json</code> toe in <code>fields/</code>.</p>`;
  const footer = HUB_LINKS.map(([t, h]) => `<a href="${esc(h)}">${esc(t)}</a>`).join(" · ");
  // hub.js reads this to know which fields to search (knits.json per slug).
  const manifest = JSON.stringify(shown.map((f) => ({ slug: f.slug, name: f.name, accent: f.accent })));
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>knitweb — het geweven web van gestemde feiten</title>
<link rel="stylesheet" href="${BASE}/tokens.css">
<style>
  body{margin:0;font-family:var(--font,system-ui,sans-serif);background:var(--bg,#0b0e14);color:var(--ink,#e6edf3);line-height:1.5}
  main{max-width:960px;margin:0 auto;padding:44px 20px 80px}
  .hero h1{font-size:30px;margin:0 0 6px} .sub{color:var(--dim,#8b95a5)}
  .strip{display:flex;gap:22px;flex-wrap:wrap;margin:20px 0 8px;padding:12px 16px;border:1px solid var(--line,#262d3a);
    border-radius:10px;font-family:var(--mono,ui-monospace,monospace);font-size:13px;color:var(--dim,#8b95a5)}
  .strip b{color:var(--ink,#e6edf3)}
  h3.lbl{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--dim,#8b95a5);margin:34px 0 12px}
  .grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
  .field-card{display:block;padding:18px;border:1px solid var(--line,#262d3a);border-radius:12px;
    text-decoration:none;color:inherit;border-left:3px solid var(--accent,#3fb6a8);transition:border-color .15s}
  .field-card:hover{border-color:var(--accent,#3fb6a8)}
  .field-card.teaser{opacity:.72} .field-card.teaser .badge{color:var(--accent,#3fb6a8)}
  .badge{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--dim,#8b95a5)}
  h2{margin:6px 0 4px;font-size:16px} .field-card p{margin:0;color:var(--dim,#8b95a5);font-size:13px}
  .empty{color:var(--dim,#8b95a5)}
  .search{margin-top:10px} .search input{width:100%;box-sizing:border-box;padding:11px 14px;border-radius:10px;
    border:1px solid var(--line,#262d3a);background:var(--panel,#141a24);color:var(--ink,#e6edf3);font-size:14px}
  .results{margin-top:10px;display:flex;flex-direction:column;gap:6px}
  .knit{display:flex;gap:12px;flex-wrap:wrap;align-items:baseline;padding:9px 12px;border:1px solid var(--line,#262d3a);border-radius:8px;font-size:13px}
  .knit .claim{flex:1;min-width:14rem} .knit .m{font-family:var(--mono,ui-monospace,monospace);color:var(--dim,#8b95a5);font-size:12px}
  footer{margin-top:44px;padding-top:16px;border-top:1px solid var(--line,#262d3a);color:var(--dim,#8b95a5);font-size:13px}
  footer a{color:var(--dim,#8b95a5)}
</style>
</head>
<body>
<main>
  <section class="hero">
    <h1>knitweb <span class="sub">· het geweven web</span></h1>
    <p class="sub">N niche-portalen uit één codebase — gestemde feiten (<b>knits</b>), gestemde relaties (<b>fiber</b>), peers ben jij. Static-first, P2P-distribueerbaar.</p>
    <div class="strip" id="strip" aria-live="polite">
      <span><b id="s-knits">–</b> knits</span><span><b id="s-fibers">–</b> fibers</span>
      <span><b id="s-peers">–</b> peers</span><span><b id="s-weft">–</b> Weft-rondes deze week</span>
    </div>
  </section>

  <h3 class="lbl">Fields</h3>
  <div class="grid">
${shown.length ? cards : empty}
  </div>

  <h3 class="lbl">Verken de fabric</h3>
  <div class="search">
    <input id="q" type="search" placeholder="zoek een knit — claim of tag…" autocomplete="off" />
    <div class="results" id="results"><p class="empty">Typ om te zoeken over alle fields.</p></div>
  </div>

  <h3 class="lbl">Devlog</h3>
  <div class="results" id="devlog"><p class="empty">Laden…</p></div>

  <footer>${footer} · <span class="sub">knitweb field-kit</span></footer>
</main>
<script>window.__BASE__=${JSON.stringify(BASE)};window.__FIELDS__=${manifest};</script>
<script type="module" src="${BASE}/hub.js"></script>
</body>
</html>
`;
}

// A field page (wireframe §2.2): top-knits list (sort score/nieuw/betwist), a
// knit-detail panel, a fiber-kaart placeholder (adjacency list — no graph lib
// yet), and the "knit indienen" form with a canonical hash-preview before local
// signing. Interactivity + signing live in src/client/field.ts (→ field.js); the
// page ships its knits inline so it renders with 0 knits and needs no blocking
// fetch. KW-005 (7).
function renderField(f, knits) {
  const inline = JSON.stringify({ slug: f.slug, name: f.name, accent: f.accent });
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(f.name)} — knitweb</title>
<link rel="stylesheet" href="${BASE}/tokens.css">
<style>
  body{margin:0;font-family:var(--font,system-ui,sans-serif);background:var(--bg,#0b0e14);color:var(--ink,#e6edf3);line-height:1.5}
  main{max-width:960px;margin:0 auto;padding:34px 20px 80px}
  a{color:var(--accent,#3fb6a8);text-decoration:none}
  header.f{display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--line,#262d3a);padding:0 0 12px 12px;margin-bottom:22px;border-left:3px solid ${esc(f.accent)}}
  header.f h1{font-size:22px;margin:0} .dim{color:var(--dim,#8b95a5)} .mono{font-family:var(--mono,ui-monospace,monospace)}
  .cols{display:grid;grid-template-columns:1.3fr 1fr;gap:22px} @media(max-width:760px){.cols{grid-template-columns:1fr}}
  .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--dim,#8b95a5);margin:0 0 10px}
  .sorts{display:flex;gap:6px;margin-bottom:10px} .sorts button{font-size:12px;padding:5px 10px;border-radius:8px;border:1px solid var(--line,#262d3a);background:transparent;color:var(--dim,#8b95a5);cursor:pointer}
  .sorts button.on{border-color:var(--accent,#3fb6a8);color:var(--ink,#e6edf3)}
  .knit{padding:11px 13px;border:1px solid var(--line,#262d3a);border-radius:10px;margin-bottom:8px;cursor:pointer;border-left:3px solid ${esc(f.accent)}}
  .knit .claim{font-weight:600} .knit .meta{font-size:12px;color:var(--dim,#8b95a5);margin-top:3px;display:flex;gap:12px;flex-wrap:wrap}
  .betwist{color:var(--warn,#e0a83a);border:1px solid var(--warn,#e0a83a);border-radius:20px;padding:0 7px;font-size:11px}
  .panel{border:1px solid var(--line,#262d3a);border-radius:12px;padding:16px;background:var(--panel,#141a24)}
  .panel h3{margin:0 0 8px;font-size:15px}
  label{display:block;font-size:12px;color:var(--dim,#8b95a5);margin:10px 0 4px}
  input,textarea,select{width:100%;box-sizing:border-box;padding:9px 11px;border-radius:9px;border:1px solid var(--line,#262d3a);background:var(--bg,#0b0e14);color:var(--ink,#e6edf3);font-size:13px;font-family:inherit}
  textarea{min-height:60px;resize:vertical}
  pre{background:var(--bg,#0b0e14);border:1px solid var(--line,#262d3a);border-radius:9px;padding:11px;overflow-x:auto;font-size:12px;white-space:pre-wrap;word-break:break-word}
  .btn{margin-top:12px;padding:10px 14px;border-radius:9px;border:0;background:var(--accent,#3fb6a8);color:#04120f;font-weight:600;cursor:pointer;font-size:13px}
  .btn:disabled{opacity:.5;cursor:not-allowed} .empty{color:var(--dim,#8b95a5)}
</style>
</head>
<body>
<main>
  <header class="f"><h1>${esc(f.name)}</h1><span class="dim">${esc(f.tagline)}</span>
    <span class="dim" style="margin-left:auto"><a href="${BASE}/">↩ hub</a></span></header>
  <div class="cols">
    <section>
      <p class="lbl">Top knits</p>
      <div class="sorts" id="sorts">
        <button data-sort="score" class="on">score</button>
        <button data-sort="new">nieuw</button>
        <button data-sort="betwist">betwist</button>
      </div>
      <div id="knits"><p class="empty">Nog geen knits — dien de eerste in →</p></div>
      <p class="lbl" style="margin-top:26px">Fiber-kaart</p>
      <div class="panel"><div id="fibers" class="dim">Geen fibers. (graafviz komt later; hier de adjacency-lijst.)</div></div>
    </section>
    <aside>
      <p class="lbl">Knit indienen</p>
      <div class="panel">
        <label>Claim</label><textarea id="k-claim" placeholder="bv. Citroenzuur-leach van BOF-slak haalt 61% V bij pH 2,1"></textarea>
        <label>Bron / assay</label><input id="k-source" placeholder="xrf:XRF-2026-0421" />
        <label>Licentie</label><input id="k-license" value="CC-BY-4.0" />
        <label>Tags (komma)</label><input id="k-tags" placeholder="leaching,vanadium" />
        <p class="lbl" style="margin:14px 0 6px">Canonieke preview + digest</p>
        <pre id="preview" class="mono">—</pre>
        <button class="btn" id="sign" disabled>Sign lokaal &amp; download .f1</button>
        <p class="dim" style="font-size:12px;margin-top:8px">Sleutel blijft lokaal (IndexedDB). v1: submissie = bestand, geen netwerk.</p>
      </div>
    </aside>
  </div>
</main>
<script>window.__BASE__=${JSON.stringify(BASE)};window.__FIELD__=${inline};window.__KNITS__=${JSON.stringify(knits)};</script>
<script type="module" src="${BASE}/field.js"></script>
</body>
</html>
`;
}

async function main() {
  const fields = await loadFields();
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  if (existsSync(STATIC)) await cp(STATIC, DIST, { recursive: true });
  await bundleClient();
  await writeFile(join(DIST, "index.html"), renderHub(fields), "utf8");
  // Ingest per-field seeds (KW-008): seeds/<slug>.knits.json → the field's knits +
  // fibers. Invalid JSON fails the build hard with the filename.
  const SEEDS = join(ROOT, "seeds");
  const live = fields.filter((x) => x.status !== "hidden");
  const seedOf = async (slug) => {
    const p = join(SEEDS, `${slug}.knits.json`);
    if (!existsSync(p)) return { knits: [], fibers: [], signed: false };
    let s;
    try {
      s = JSON.parse(await readFile(p, "utf8"));
    } catch (e) {
      throw new BuildError(`seeds/${slug}.knits.json: ongeldige JSON — ${e.message}`);
    }
    const knits = s.knits || [], fibers = s.fibers || [];
    // KW-008 acc.1: if a curator signer is declared, every knit MUST carry a valid
    // secp256k1 signature (fabric §A4) bound to that signer — else the build fails.
    // No signer → "provisional" seeds (allowed, logged), pending real contributions.
    if (s.signer) {
      for (const k of knits) {
        if (!k.sig || !k.rid) throw new BuildError(`seeds/${slug}.knits.json: knit "${k.id}" mist handtekening (signer gedeclareerd)`);
        const rec = knitRecord(k, { field: s.field, signerPub: s.signer, ts: s.ts });
        rec.sig = k.sig; rec.id = k.rid;
        if (!verify(serialize(rec), s.signer)) throw new BuildError(`seeds/${slug}.knits.json: ongeldige handtekening op knit "${k.id}"`);
      }
    }
    return { knits, fibers, signed: !!s.signer, signer: s.signer };
  };
  const seeds = {};
  let totKnits = 0, totFibers = 0;
  for (const f of live) {
    seeds[f.slug] = await seedOf(f.slug);
    totKnits += seeds[f.slug].knits.length;
    totFibers += seeds[f.slug].fibers.length;
  }
  // Fabric-strip source (§A6): real counts from the ingested seeds.
  await writeFile(
    join(DIST, "stats.json"),
    JSON.stringify({ knits: totKnits, fibers: totFibers, peers: 0, weft: 0, fields: fields.length }),
    "utf8"
  );
  // Per-field pages (§2.2) + a knits.json search index, populated from the seeds.
  for (const f of live) {
    const knits = seeds[f.slug].knits;
    await mkdir(join(DIST, f.slug), { recursive: true });
    await writeFile(join(DIST, f.slug, "index.html"), renderField(f, knits), "utf8");
    await writeFile(join(DIST, f.slug, "knits.json"), JSON.stringify(knits), "utf8");
  }
  // Devlog-feed (KW-010): CHANGELOG.md → dist/feed.json voor de hub-strip.
  const clPath = join(ROOT, "CHANGELOG.md");
  const feed = existsSync(clPath) ? feedFromChangelog(await readFile(clPath, "utf8"), { limit: 20 }) : { version: 1, entries: [] };
  await writeFile(join(DIST, "feed.json"), JSON.stringify(feed), "utf8");
  const signed = live.filter((f) => seeds[f.slug].signed).map((f) => f.slug);
  console.log(`✓ build ok — ${fields.length} field(s), ${totKnits} knits + ${totFibers} fibers, ${feed.entries.length} devlog-entries → dist/`);
  console.log(signed.length ? `  ✓ signer-geverifieerd: ${signed.join(", ")}` : `  · geen ondertekende seeds (provisional)`);
}

main().catch((e) => {
  if (e instanceof BuildError) console.error(`✗ build gefaald: ${e.message}`);
  else console.error(`✗ build gefaald:`, e);
  process.exit(1);
});
