// Hub client (KW-004): fills the live fabric-strip from stats.json and powers the
// explorer-teaser — a client-side search over each field's knits.json. Same-origin
// only; every fetch degrades gracefully so the static hub works before ingest (KW-008)
// has produced any knits. Also keeps the subtle field-card hover lift.

type Field = { slug: string; name: string; accent: string };
type Knit = {
  claim?: string;
  tags?: string[];
  score?: number;
  fibers?: number;
  source?: string;
  id?: string;
};

const $ = (id: string) => document.getElementById(id);
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// Base-path prefix (KNITWEB_BASE at build time) so the hub works under a project
// subpath (e.g. knitweb.github.io/knitweb/) as well as at a domain root. "" = root.
const BASE: string = (window as unknown as { __BASE__?: string }).__BASE__ || "";

async function json<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(BASE + url, { credentials: "same-origin" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

// --- fabric-strip ---------------------------------------------------------
async function fillStrip() {
  const s = await json<Record<string, number>>("/stats.json");
  const set = (id: string, v: number | undefined) => {
    const el = $(id);
    if (el) el.textContent = (v ?? 0).toLocaleString("nl-NL");
  };
  set("s-knits", s?.knits);
  set("s-fibers", s?.fibers);
  set("s-peers", s?.peers);
  set("s-weft", s?.weft);
}

// --- explorer-teaser: search over all fields' knits.json ------------------
let INDEX: Array<Knit & { field: Field }> = [];
let loaded = false;

async function loadIndex(fields: Field[]) {
  if (loaded) return;
  loaded = true;
  const per = await Promise.all(
    fields.map(async (f) => {
      const knits = (await json<Knit[]>(`/${f.slug}/knits.json`)) || [];
      return knits.map((k) => ({ ...k, field: f }));
    })
  );
  INDEX = per.flat();
}

function render(rows: Array<Knit & { field: Field }>, q: string) {
  const box = $("results");
  if (!box) return;
  if (!q) {
    box.innerHTML = `<p class="empty">Typ om te zoeken over alle fields.</p>`;
    return;
  }
  if (!rows.length) {
    box.innerHTML = `<p class="empty">Nog geen knits gevonden voor “${esc(q)}”.</p>`;
    return;
  }
  box.innerHTML = rows
    .slice(0, 40)
    .map(
      (k) => `<div class="knit" style="border-left:3px solid ${esc(k.field.accent)}">
        <span class="claim">${esc(k.claim || "(geen claim)")}</span>
        <span class="m">▲ ${k.score ?? 0}</span>
        <span class="m">${k.fibers ?? 0} fiber</span>
        <span class="m">${esc(k.source || "—")}</span>
        <span class="m">${esc((k.id || "").slice(0, 10))}</span>
      </div>`
    )
    .join("");
}

function search(q: string) {
  const needle = q.trim().toLowerCase();
  const rows = !needle
    ? []
    : INDEX.filter(
        (k) =>
          (k.claim || "").toLowerCase().includes(needle) ||
          (k.tags || []).some((t) => t.toLowerCase().includes(needle))
      );
  render(rows, needle);
}

// --- devlog strip: recent CHANGELOG entries from feed.json -----------------
type Feed = { version: number; entries: Array<{ text: string; refs: number[] }> };
async function fillDevlog() {
  const box = $("devlog");
  if (!box) return;
  const feed = await json<Feed>("/feed.json");
  const rows = feed?.entries ?? [];
  if (!rows.length) {
    box.innerHTML = `<p class="empty">Nog geen devlog-entries.</p>`;
    return;
  }
  box.innerHTML = rows
    .slice(0, 6)
    .map((e) => {
      const refs = (e.refs || [])
        .map((n) => `<a class="m" href="https://github.com/Knitweb/knitweb/issues/${n}">#${n}</a>`)
        .join(" ");
      return `<div class="knit"><span class="claim">${esc(e.text)}</span>${refs ? `<span class="m">${refs}</span>` : ""}</div>`;
    })
    .join("");
}

function hoverLift() {
  for (const card of document.querySelectorAll<HTMLElement>(".field-card")) {
    card.addEventListener("pointerenter", () => {
      card.style.transform = "translateY(-2px)";
      card.style.transition = "transform .15s";
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  }
}

function main() {
  const fields: Field[] = (window as unknown as { __FIELDS__?: Field[] }).__FIELDS__ || [];
  hoverLift();
  fillStrip();
  fillDevlog();
  const input = $("q") as HTMLInputElement | null;
  if (!input) return;
  input.addEventListener("input", async () => {
    await loadIndex(fields); // lazy: only fetch knits once the user searches
    search(input.value);
  });
}

main();
export {};
