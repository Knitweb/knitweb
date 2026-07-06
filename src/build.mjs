#!/usr/bin/env node
// build.mjs — SSG build pipeline (SPEC §A1–A2, §A6).
// Reads fields/ (+ seeds/ later) → dist/. No framework, no CSS-lib.
// Fails hard (exit != 0) with a readable error on an invalid field config.
import { readdir, readFile, mkdir, rm, cp, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateField } from "./lib/validate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIELDS = join(ROOT, "fields");
const STATIC = join(ROOT, "static");
const CLIENT = join(ROOT, "src", "client");
// Output dir: default dist/, override met KNITWEB_DIST (bv. voor geïsoleerde test-builds).
const DIST = process.env.KNITWEB_DIST ? resolve(process.env.KNITWEB_DIST) : join(ROOT, "dist");
const SCHEMA_PATH = join(ROOT, "field.schema.json");

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
const HUB_LINKS = [
  ["GitHub", "https://github.com/Knitweb"],
  ["Radicle", "#"],
  ["GitLab", "#"],
  ["Discord", "#"],
];

// The hub (wireframe §2.1): hero + live fabric-strip (stats.json) + field-grid
// (order-sorted, hidden filtered, teaser badged) + explorer-teaser (client search
// over each field's knits.json). One small module bundle (/hub.js), zero external
// origins. KW-004 (5).
function renderHub(fields) {
  const shown = fields.filter((f) => f.status !== "hidden");
  const cards = shown
    .map(
      (f) => `      <a class="field-card ${esc(f.status)}" href="/${esc(f.slug)}/" style="--accent:${esc(f.accent)}">
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
<link rel="stylesheet" href="/tokens.css">
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

  <footer>${footer} · <span class="sub">knitweb field-kit</span></footer>
</main>
<script>window.__FIELDS__=${manifest};</script>
<script type="module" src="/hub.js"></script>
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
  // Fabric-strip source (§A6). Real counts arrive with ingest (KW-008); until then
  // a zero stub keeps the hub's strip working with a graceful "0" instead of a fetch error.
  await writeFile(
    join(DIST, "stats.json"),
    JSON.stringify({ knits: 0, fibers: 0, peers: 0, weft: 0, fields: fields.length }),
    "utf8"
  );
  console.log(`✓ build ok — ${fields.length} field(s) → dist/`);
}

main().catch((e) => {
  if (e instanceof BuildError) console.error(`✗ build gefaald: ${e.message}`);
  else console.error(`✗ build gefaald:`, e);
  process.exit(1);
});
