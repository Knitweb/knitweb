// build.test.mjs — build smoketests (SPEC §A6). Uses node:test (no test dep).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD = join(ROOT, "src", "build.mjs");
const DIST = join(ROOT, "dist");
const FIELDS = join(ROOT, "fields");

function runBuild() {
  return execFileSync("node", [BUILD], { cwd: ROOT, encoding: "utf8" });
}

test("build produces dist/index.html with the configured live field", () => {
  runBuild();
  const index = join(DIST, "index.html");
  assert.ok(existsSync(index), "dist/index.html moet bestaan");
  const html = readFileSync(index, "utf8");
  assert.match(html, /ChemField/i, "hub moet het live chemfield-portaal tonen");
  assert.ok(existsSync(join(DIST, "tokens.css")), "static/tokens.css moet mee-gekopieerd zijn");
});

test("build fails hard (exit != 0) on an invalid field.json", () => {
  const bad = join(FIELDS, "_invalid.field.json");
  writeFileSync(bad, "{ this is not valid json ", "utf8");
  try {
    assert.throws(
      () => execFileSync("node", [BUILD], { cwd: ROOT, stdio: "pipe" }),
      (err) => err.status !== 0,
      "build hoort met exit != 0 te falen bij ongeldige field.json"
    );
  } finally {
    rmSync(bad, { force: true });
  }
  // repo builds cleanly again after the bad file is gone
  runBuild();
  assert.ok(existsSync(join(DIST, "index.html")));
});

test("KNITWEB_BASE prefixes every absolute asset/page path (subpath deploy)", () => {
  const OUT = join(ROOT, ".tmp-base-dist");
  try {
    execFileSync("node", [BUILD], {
      cwd: ROOT, encoding: "utf8",
      env: { ...process.env, KNITWEB_BASE: "knitweb", KNITWEB_DIST: OUT },
    });
    const hub = readFileSync(join(OUT, "index.html"), "utf8");
    // base injected for the client, and every root-absolute href/src is prefixed
    assert.match(hub, /window\.__BASE__="\/knitweb"/, "hub moet __BASE__ injecteren");
    const abs = [...hub.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1])
      .filter((u) => !u.startsWith("//")); // ignore protocol-relative (none expected)
    assert.ok(abs.length > 0, "hub heeft absolute paden");
    for (const u of abs) {
      assert.ok(u.startsWith("/knitweb/"), `absoluut pad ${u} moet met /knitweb/ beginnen (dode link onder subpad)`);
    }
    // field page too
    const field = readFileSync(join(OUT, "chemfield", "index.html"), "utf8");
    for (const u of [...field.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1])) {
      assert.ok(u.startsWith("/knitweb/"), `field-pad ${u} moet met /knitweb/ beginnen`);
    }
    // client bundle reads the injected global
    assert.match(readFileSync(join(OUT, "hub.js"), "utf8"), /__BASE__/);
  } finally {
    rmSync(OUT, { recursive: true, force: true });
  }
});

test("default build (no KNITWEB_BASE) stays root-absolute — unchanged", () => {
  runBuild();
  const hub = readFileSync(join(DIST, "index.html"), "utf8");
  assert.match(hub, /window\.__BASE__=""/, "root-deploy: __BASE__ leeg");
  assert.match(hub, /href="\/tokens\.css"/, "root-deploy: tokens.css blijft /-absoluut");
});

test("hub has no dead placeholder links (no href=\"#\")", () => {
  runBuild();
  const hub = readFileSync(join(DIST, "index.html"), "utf8");
  assert.ok(!/href="#"/.test(hub), "de live hub mag geen dode #-placeholder-links bevatten");
  // and every footer link is an absolute http(s) URL or a BASE-prefixed path
  for (const href of [...hub.matchAll(/<footer[\s\S]*?<\/footer>/g)]
      .flatMap((f) => [...f[0].matchAll(/href="([^"]+)"/g)].map((m) => m[1]))) {
    assert.ok(/^https?:\/\//.test(href) || href.startsWith("/"), `footer-link ${href} moet absoluut zijn`);
  }
});

test("build emits per-field 3D-graph data + a shared viewer (no dangling links)", () => {
  runBuild();
  // shared viewer + field manifest
  assert.ok(existsSync(join(DIST, "graph.html")), "graph.html (viewer) moet bestaan");
  const idx = JSON.parse(readFileSync(join(DIST, "graph-index.json"), "utf8"));
  assert.ok(Array.isArray(idx) && idx.length >= 1, "graph-index moet fields bevatten");
  // the live field has a non-empty, self-consistent graph
  const chem = idx.find((f) => f.slug === "chemfield");
  assert.ok(chem && chem.nodes > 0 && chem.links > 0, "chemfield graph moet knopen+links hebben");
  const g = JSON.parse(readFileSync(join(DIST, "chemfield", "graph.json"), "utf8"));
  const ids = new Set(g.nodes.map((n) => n.id));
  for (const l of g.links) {
    assert.ok(ids.has(l.source) && ids.has(l.target), `dangling link ${l.source}->${l.target}`);
  }
  // every node carries a colour + group (renderable)
  for (const n of g.nodes) { assert.ok(n.color && n.group && n.name, `node ${n.id} mist color/group/name`); }
  // counts in the index match the emitted graph
  assert.equal(chem.nodes, g.nodes.length);
  assert.equal(chem.links, g.links.length);
});
