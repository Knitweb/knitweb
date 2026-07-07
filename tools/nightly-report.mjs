// nightly-report.mjs (KW-010) — genereert reports/Nachtploeg-rapport-<datum>.md UITSLUITEND
// uit git-feiten (git log/diffstat). Geen hallucineerbare samenvatting: elke regel is
// herleidbaar naar git. Usage: node tools/nightly-report.mjs [YYYY-MM-DD]
import { execFileSync } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const date = process.argv[2] || git(["log", "-1", "--format=%cs"]); // default: datum van HEAD
const since = `${date} 00:00:00`, until = `${date} 23:59:59`;

const fmt = "%H%x1f%s%x1f%an%x1f%cI";
const raw = git(["log", `--since=${since}`, `--until=${until}`, `--pretty=format:${fmt}`]);
const commits = raw ? raw.split("\n").map((l) => {
  const [hash, subject, author, iso] = l.split("\x1f");
  const refs = [...subject.matchAll(/#(\d+)/g)].map((m) => m[1]);
  return { hash, subject, author, iso, refs };
}) : [];

let diffstat = "—";
if (commits.length) {
  const last = commits[commits.length - 1].hash, first = commits[0].hash;
  try { diffstat = git(["diff", "--stat", `${last}~1`, first]) || "—"; } catch { diffstat = "(geen diffstat)"; }
}
const prs = [...new Set(commits.flatMap((c) => c.refs))].sort((a, b) => a - b);

const lines = [
  `# Nachtploeg-rapport ${date}`, "",
  `*Gegenereerd uit git — alle punten zijn herleidbaar naar commits; geen samenvatting-door-model.*`, "",
  `## Commits (${commits.length})`,
  ...(commits.length ? commits.map((c) => `- \`${c.hash.slice(0, 8)}\` ${c.subject} — ${c.author} (${c.iso})`) : ["- (geen)"]),
  "", `## Issues/PR's aangeraakt`,
  prs.length ? prs.map((n) => `#${n}`).join(", ") : "(geen)",
  "", `## Diffstat`, "```", diffstat, "```", "",
  `## Open vragen`, `- (handmatig aanvullen — het rapport bevat alleen git-feiten)`, "",
];
await mkdir("reports", { recursive: true });
const dst = join("reports", `Nachtploeg-rapport-${date}.md`);
await writeFile(dst, lines.join("\n"), "utf8");
console.log(`✓ ${dst} — ${commits.length} commit(s), ${prs.length} issue-ref(s)`);
