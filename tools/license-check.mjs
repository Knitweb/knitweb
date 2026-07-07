// license-check.mjs (KW-009) — fail if any PRODUCTION dependency ships a license
// outside the permissive whitelist. Dev tooling (eslint/esbuild) is not shipped and
// is excluded via --omit=dev. Uses only `npm ls` + node_modules package.json — no
// third-party scanner.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
// Resolve a hoisted package dir; fall back to the dependent's nested node_modules.
function resolvePkg(name, fromPath) {
  const candidates = [fromPath && join(fromPath, "node_modules", name), join(ROOT, "node_modules", name)].filter(Boolean);
  return candidates.find((p) => existsSync(join(p, "package.json")));
}

const WHITELIST = [
  /^MIT$/i, /^ISC$/i, /^0BSD$/i, /^BSD-2-Clause$/i, /^BSD-3-Clause$/i,
  /^Apache-2\.0$/i, /^CC0-1\.0$/i, /^Unlicense$/i, /^BlueOak-1\.0\.0$/i,
];
const ok = (lic) => typeof lic === "string" && WHITELIST.some((re) => re.test(lic.replace(/^\(|\)$/g, "").trim()));

function licenseOf(pkgPath) {
  try {
    const p = JSON.parse(readFileSync(join(pkgPath, "package.json"), "utf8"));
    if (typeof p.license === "string") return p.license;
    if (p.license?.type) return p.license.type;
    if (Array.isArray(p.licenses) && p.licenses[0]?.type) return p.licenses[0].type;
  } catch { /* ontbrekend pad → als onbekend gerapporteerd */ }
  return "UNKNOWN";
}

const tree = JSON.parse(execFileSync("npm", ["ls", "--omit=dev", "--all", "--json"], { encoding: "utf8", maxBuffer: 32 << 20 }));
const seen = new Map(); // name@version → license
(function walk(node, fromPath) {
  for (const [name, dep] of Object.entries(node.dependencies || {})) {
    const key = `${name}@${dep.version}`;
    const dir = resolvePkg(name, fromPath);
    if (!seen.has(key)) seen.set(key, dir ? licenseOf(dir) : "UNKNOWN");
    walk(dep, dir);
  }
})(tree, ROOT);

const bad = [...seen].filter(([, lic]) => !ok(lic));
for (const [k, lic] of [...seen].sort()) console.log(`  ${ok(lic) ? "✓" : "✗"} ${k} — ${lic}`);
if (bad.length) {
  console.error(`\n✗ license-check: ${bad.length} niet-toegestane licentie(s): ${bad.map(([k, l]) => `${k} (${l})`).join(", ")}`);
  console.error(`  whitelist: MIT, ISC, 0BSD, BSD-2/3-Clause, Apache-2.0, CC0-1.0, Unlicense, BlueOak-1.0.0`);
  process.exit(1);
}
console.log(`\n✓ license-check: ${seen.size} prod-dep(s), alle permissief.`);
