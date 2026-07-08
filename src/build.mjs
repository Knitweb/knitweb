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

// Footer-links als config-constanten (placeholders — vervang bij launch).
const FOOTER_LINKS = [
  { label: "GitHub", href: "https://github.com/Knitweb" },
  { label: "Radicle", href: "#radicle" },
  { label: "GitLab", href: "#gitlab" },
  { label: "Discord", href: "#discord" },
];

function renderHub(fields) {
  const visible = fields.filter((f) => f.status !== "hidden"); // §A6: hidden telt niet
  const cards = visible
    .map(
      (f) => `      <a class="field-card" href="/${esc(f.slug)}/" data-slug="${esc(f.slug)}" data-status="${esc(f.status)}" style="--accent:${esc(f.accent)}">
        <span class="badge-status ${esc(f.status)}">${esc(f.status)}</span>
        <h3>${esc(f.name)}</h3>
        <p>${esc(f.tagline)}</p>
      </a>`
    )
    .join("\n");
  const gridEmpty = `      <p class="empty">Nog geen fields geconfigureerd. Voeg een <code>*.field.json</code> toe in <code>fields/</code>.</p>`;
  const footer = FOOTER_LINKS.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join(" · ");
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>knitweb — field-kit</title>
<meta name="description" content="N niche-portalen uit één codebase. Getekende, peer-gevalideerde feiten. Static-first, P2P-distribueerbaar.">
<link rel="stylesheet" href="/tokens.css">
<style>
  main{max-width:960px;margin:0 auto;padding:36px 20px 64px}
  .hero h1{font-size:32px;margin:0} .hero h1 .g{color:var(--accent)}
  .hero p{color:var(--dim);max-width:620px;margin:10px 0 0}
  h2.sec{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--dim);margin:34px 0 12px}
  .grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
  .explorer input{width:100%;background:var(--panel-2,#1b242b);border:1px solid var(--line);border-radius:10px;
    color:var(--ink);font:inherit;padding:11px 14px;outline:none}
  .explorer input:focus{border-color:var(--accent)}
  .results{display:grid;gap:10px;margin-top:14px}
  .empty{color:var(--dim);font-style:italic}
  footer{margin-top:44px;padding-top:16px;border-top:1px solid var(--line);color:var(--dim);font-size:13px}
  footer a{color:var(--dim)}
</style>
</head>
<body>
<main>
  <section class="hero">
    <h1>knit<span class="g">web</span> <span style="color:var(--dim);font-size:18px">· field-kit</span></h1>
    <p>N niche-portalen uit één codebase. Getekende, peer-gevalideerde feiten —
       static-first en P2P-distribueerbaar. De fabric ís de database.</p>
  </section>

  <div class="strip" role="status" aria-label="live fabric-statistieken">
    <span>knits <b id="s-knits">—</b></span>
    <span>fibers <b id="s-fibers">—</b></span>
    <span>votes <b id="s-votes">—</b></span>
    <span>fields <b id="s-fields">${visible.length}</b></span>
    <span>bijgewerkt <b id="s-updated">—</b></span>
  </div>

  <h2 class="sec">Fields</h2>
  <div class="grid" id="fields">
${cards || gridEmpty}
  </div>

  <h2 class="sec">Explorer <span style="text-transform:none;letter-spacing:0;color:var(--dim)">— zoek in alle knits</span></h2>
  <div class="explorer">
    <input id="q" type="search" placeholder="Zoek op claim of tag…" autocomplete="off" spellcheck="false" aria-label="Zoek knits">
    <div class="results" id="results"><p class="empty">nog geen knits</p></div>
  </div>

  <footer>
    <div>${footer}</div>
    <div style="margin-top:6px">knitweb field-kit · <a href="https://github.com/Knitweb/knitweb/blob/main/docs/SPEC-v0.1.md">Spec v0.1</a></div>
  </footer>
</main>
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
  console.log(`✓ build ok — ${fields.length} field(s) → dist/`);
}

main().catch((e) => {
  if (e instanceof BuildError) console.error(`✗ build gefaald: ${e.message}`);
  else console.error(`✗ build gefaald:`, e);
  process.exit(1);
});
