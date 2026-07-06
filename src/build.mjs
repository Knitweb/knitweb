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

function renderHub(fields) {
  const cards = fields
    .filter((f) => f.status !== "hidden")
    .map(
      (f) => `    <a class="field-card" href="/${esc(f.slug)}/" style="--accent:${esc(f.accent)}">
      <span class="badge">${esc(f.status)}</span>
      <h2>${esc(f.name)}</h2>
      <p>${esc(f.tagline)}</p>
    </a>`
    )
    .join("\n");
  const empty = `    <p class="empty">Nog geen fields geconfigureerd. Voeg een <code>*.field.json</code> toe in <code>fields/</code>.</p>`;
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>knitweb — field-kit</title>
<link rel="stylesheet" href="/tokens.css">
<style>
  body{margin:0;font-family:var(--font,system-ui,sans-serif);background:var(--bg,#0b0e14);color:var(--ink,#e6edf3)}
  main{max-width:900px;margin:0 auto;padding:40px 20px}
  h1{font-size:28px} .sub{color:var(--dim,#8b95a5)}
  .grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));margin-top:24px}
  .field-card{display:block;padding:18px;border:1px solid var(--line,#262d3a);border-radius:12px;
    text-decoration:none;color:inherit;border-left:3px solid var(--accent,#3fb6a8)}
  .field-card:hover{border-color:var(--accent,#3fb6a8)}
  .badge{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--dim,#8b95a5)}
  h2{margin:6px 0 4px;font-size:16px} p{margin:0;color:var(--dim,#8b95a5);font-size:13px}
  .empty{color:var(--dim,#8b95a5)}
</style>
</head>
<body>
<main>
  <h1>knitweb <span class="sub">· field-kit</span></h1>
  <p class="sub">N niche-portalen uit één codebase. Static-first, P2P-distribueerbaar. (hub-placeholder — KW-004)</p>
  <div class="grid">
${fields.filter((f) => f.status !== "hidden").length ? cards : empty}
  </div>
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
