// feed.mjs (KW-010) — CHANGELOG.md → devlog feed. Elke top-level "- "-bullet is één
// entry; issue-refs (#n) worden geëxtraheerd. Geen verzonnen data: tekst is verbatim.
export function parseChangelog(md) {
  const entries = [];
  for (const raw of String(md).split("\n")) {
    const m = /^-\s+(.+)$/.exec(raw);
    if (!m) continue;
    const text = m[1].trim();
    const refs = [...text.matchAll(/#(\d+)/g)].map((x) => Number(x[1]));
    entries.push({ text, refs });
  }
  return entries;
}
export function feedFromChangelog(md, { limit = 20 } = {}) {
  return { version: 1, entries: parseChangelog(md).slice(0, limit) };
}
