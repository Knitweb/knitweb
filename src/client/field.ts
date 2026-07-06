// Field page client (KW-005): renders the top-knits list with deterministic
// sorting (§A5), a knit-detail panel, and the "knit indienen" form — building a
// canonical knit/1 record with a live digest preview, then signing it locally
// (a secp256k1 key kept in IndexedDB) and downloading a .f1 file. No network.

import { secp256k1 } from "@noble/curves/secp256k1";
import { serialize, digestOf, signRecord, authorFromPriv } from "../lib/fabric.js";

type Field = { slug: string; name: string; accent: string };
type Knit = {
  id?: string;
  claim?: string;
  tags?: string[];
  source?: string;
  score?: number;
  ts?: number;
  confirms?: number;
  votes?: number;
};

const F: Field = (window as any).__FIELD__ || { slug: "", name: "", accent: "#3fb6a8" };
const KNITS: Knit[] = (window as any).__KNITS__ || [];
const $ = (id: string) => document.getElementById(id);
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// --- top-knits list, deterministic sort (§A5) -----------------------------
const betwist = (k: Knit) => (k.votes ?? 0) >= 8 && (k.votes! - (k.confirms ?? 0)) / k.votes! >= 0.25;

function sortKnits(mode: string): Knit[] {
  const a = [...KNITS];
  if (mode === "new") a.sort((x, y) => (y.ts ?? 0) - (x.ts ?? 0) || (x.id || "").localeCompare(y.id || ""));
  else if (mode === "betwist") a.sort((x, y) => Number(betwist(y)) - Number(betwist(x)) || (y.score ?? 0) - (x.score ?? 0));
  else a.sort((x, y) => (y.score ?? 0) - (x.score ?? 0) || (y.ts ?? 0) - (x.ts ?? 0) || (x.id || "").localeCompare(y.id || ""));
  return a;
}

function renderList(mode: string) {
  const box = $("knits");
  if (!box) return;
  const rows = sortKnits(mode);
  if (!rows.length) {
    box.innerHTML = `<p class="empty">Nog geen knits — dien de eerste in →</p>`;
    return;
  }
  box.innerHTML = rows
    .map(
      (k) => `<div class="knit">
        <div class="claim">${esc(k.claim || "(geen claim)")}${betwist(k) ? ' <span class="betwist">betwist</span>' : ""}</div>
        <div class="meta"><span>▲ ${k.score ?? 0}</span><span>${esc(k.source || "—")}</span>
          <span class="mono">${esc((k.id || "").slice(0, 12))}</span></div>
      </div>`
    )
    .join("");
}

function wireSorts() {
  const bar = $("sorts");
  if (!bar) return;
  bar.querySelectorAll<HTMLButtonElement>("button").forEach((b) =>
    b.addEventListener("click", () => {
      bar.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      renderList(b.dataset.sort || "score");
    })
  );
}

// --- local key (IndexedDB) ------------------------------------------------
const DB = "knitweb", STORE = "keys";
function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function getKey(): Promise<Uint8Array> {
  const db = await idb();
  const existing: Uint8Array | undefined = await new Promise((res) => {
    const t = db.transaction(STORE).objectStore(STORE).get("priv");
    t.onsuccess = () => res(t.result);
    t.onerror = () => res(undefined);
  });
  if (existing) return existing;
  const priv = secp256k1.utils.randomPrivateKey();
  await new Promise<void>((res) => {
    const t = db.transaction(STORE, "readwrite").objectStore(STORE).put(priv, "priv");
    t.onsuccess = () => res();
    t.onerror = () => res();
  });
  return priv;
}

// --- build a knit/1 record from the form ----------------------------------
function draft(author: string) {
  const rec: Record<string, string> = { type: "knit/1", field: F.slug };
  const claim = ($("k-claim") as HTMLTextAreaElement)?.value.trim();
  const source = ($("k-source") as HTMLInputElement)?.value.trim();
  const license = ($("k-license") as HTMLInputElement)?.value.trim();
  const tags = ($("k-tags") as HTMLInputElement)?.value.trim();
  if (claim) rec.claim = claim;
  if (source) rec.source = source;
  if (license) rec.license = license;
  rec.lang = "nl";
  if (tags) rec.tags = tags;
  rec.author = author;
  rec.ts = String(Date.now());
  rec.prev = "-";
  return rec as any;
}

let PRIV: Uint8Array | null = null;

async function refreshPreview() {
  const pre = $("preview")!;
  const btn = $("sign") as HTMLButtonElement;
  const claim = ($("k-claim") as HTMLTextAreaElement)?.value.trim();
  if (!claim) {
    pre.textContent = "—";
    btn.disabled = true;
    return;
  }
  PRIV = PRIV || (await getKey());
  const rec = draft(authorFromPriv(PRIV));
  const body = serialize(rec);
  pre.textContent = `${body}\n\ndigest: ${digestOf(rec)}`;
  btn.disabled = false;
}

async function signAndDownload() {
  if (!PRIV) PRIV = await getKey();
  const rec = draft(authorFromPriv(PRIV));
  const signed = signRecord(rec, PRIV);
  const text = serialize(signed);
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${F.slug}-${(signed.id || "knit").slice(0, 12)}.f1`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function main() {
  wireSorts();
  renderList("score");
  ["k-claim", "k-source", "k-license", "k-tags"].forEach((id) =>
    $(id)?.addEventListener("input", () => void refreshPreview())
  );
  $("sign")?.addEventListener("click", () => void signAndDownload());
}

main();
export {};
