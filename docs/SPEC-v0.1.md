# Field-Kit Spec v0.1

*5 juli 2026. Dit is het referentiedocument waarnaar de nachtploeg-issues KW-001…KW-010 verwijzen. Spec v0.1 is bevroren zodra KW-006 gemerged is (golden vectors = de wet). Wijzigingen daarna heten v0.2 en vereisen migratienotitie.*

## A1. Doel & principes

De field-kit rendert **N niche-portalen uit één codebase**: een field is een configbestand, geen website. Principes, in volgorde van gewicht:

1. **Static-first, P2P-distribueerbaar.** Build-output is een map met HTML/CSS/JS/JSON die van elke host (anchor, Hetzner, peers, GitHub Pages) identiek werkt. Geen server-side rendering, geen database — de fabric ís de database.
2. **Agent-bestuurbaar.** Geen framework: vanilla TypeScript/JS + esbuild. Frameworks maken agent-PR's groot en reviews traag; template-literals maken ze klein en toetsbaar.
3. **Alles wat telt is een getekend record.** Knits, fibers en votes zijn field/1-records met harde canonicalisatie (§A4).
4. **Dependency-dieet.** Toegestaan zonder motivatie: `esbuild` (dev), `@noble/curves`, `@noble/hashes` (runtime, geauditeerd, klein). Al het andere vereist motivatie in de PR.

## A2. Directory-layout (monorepo `knitweb`)

```
knitweb/
  fields/                    # één *.field.json per field
    chemfield.field.json
    gangfield.field.json
    ledgerfield.field.json
  seeds/                     # seed-records per field
    chemfield.seed.f1
  src/
    build.mjs                # SSG: leest fields/ + seeds/ → dist/
    lib/fabric.ts            # canonical, keccak, sign/verify, score
    lib/records.ts           # knit/1, fiber/1, vote/1 parse/serialize
    ui/                      # knit-card, vote-widget, field-grid, …
    pages/hub.ts             # wireframe §2.1 (GTM-werkplan)
    pages/field.ts           # wireframe §2.2 (GTM-werkplan)
  static/
    tokens.css               # designtokens (foundry-dark)
    svgg/                    # vector-assets
  tests/                     # unit + golden vectors (verplicht)
  dist/                      # build-output (deploy-artifact)
  .github/workflows/         # ci.yml, deploy.yml, mirrors.yml
  CHANGELOG.md               # elke merge één regel (feed-bron)
```

## A3. `field.schema.json` (config-contract)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "knitweb field config v0.1",
  "type": "object",
  "required": ["slug", "name", "accent", "tagline", "status", "order"],
  "additionalProperties": false,
  "properties": {
    "slug":     { "type": "string", "pattern": "^[a-z][a-z0-9]{2,23}$" },
    "name":     { "type": "string", "maxLength": 40 },
    "accent":   { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" },
    "tagline":  { "type": "string", "maxLength": 120 },
    "status":   { "enum": ["live", "teaser", "hidden"] },
    "order":    { "type": "integer", "minimum": 0 },
    "taxonomy": { "type": "array", "items": { "type": "string" }, "maxItems": 32 },
    "seed":     { "type": "string", "description": "pad naar *.seed.f1" },
    "ingest":   { "type": "array", "items": {
        "type": "object",
        "required": ["type"],
        "properties": {
          "type": { "enum": ["seed", "rss", "pypi", "vank-report", "manual"] },
          "url":  { "type": "string" },
          "interval_h": { "type": "integer", "minimum": 1 }
        }
    }},
    "judges":   { "type": "array", "items": { "type": "string" } },
    "links":    { "type": "object", "properties": {
        "repo": { "type": "string" }, "docs": { "type": "string" }
    }}
  }
}
```

Startwaarden: chemfield `#3fb6a8` (live), gangfield `#f4b41a` (teaser), ledgerfield `#d4a017` (teaser).
Draagvlak-fields (per besluit 2026-07-05, mee als fixtures): modelfield `#a855f7` (hidden), energyfield `#22c55e` (hidden), codefield `#3b82f6` (hidden). Zodra de hub live is (KW-004) worden modelfield/energyfield als "coming soon"-teaser getoond.

## A4. Recordformaten: knit/1, fiber/1, vote/1

**Vorm.** Line-based UTF-8 (DYAD-familie), `key: value` per regel, vaste sleutelvolgorde per type (exact zoals hieronder), afgesloten met `sig:` en `id:`. Records zijn hash-stabiel en door elke peer verifieerbaar.

**Canonicalisatie (hard):**
1. Encoding UTF-8, Unicode-normalisatie **NFC** op alle values vóór serialisatie.
2. Regelscheider exact `\n` (geen `\r`), geen lege regels, geen trailing whitespace, bestand eindigt zonder newline na de `id:`-regel.
3. Keys lowercase, gevolgd door exact `: ` (dubbele punt + één spatie).
4. Newlines in values geëscaped als `\n` (backslash-n); backslash als `\\`. Geen andere escapes.
5. Timestamps: integer milliseconden UTC. Ontbrekend optioneel veld: regel weglaten (nooit lege value).
6. **Digest** = keccak256 over de canonieke bytes van alle regels t/m de regel vóór `sig:`.
7. **sig** = secp256k1-handtekening (compact hex) over de digest, door `author`-sleutel.
8. **id** = keccak256 over álle regels t/m en met `sig:`, hex.
9. **author** = eerste 24 hex van keccak256(compressed pubkey).

*(Bewuste keuze: keccak256+secp256k1 = DYAD-consistent; Vank blijft zijn eigen Ed25519-domein en komt de fabric binnen via de `vank-report`-ingest, die Vank-events als knits verpakt met bronverwijzing.)*

**knit/1** (gestemd feit):

```
knit/1
field: chemfield
claim: Citroenzuur-leach van BOF-slak haalt 61% V-yield bij pH 2,1 / 40 C
source: xrf:XRF-2026-0421
license: CC-BY-4.0
lang: nl
tags: leaching,vanadium
author: 3f9ac2…(24 hex)
ts: 1751712000000
prev: -
sig: <hex>
id: <hex>
```

**fiber/1** (gestemde relatie): keys `fiber/1, rel, from, to, field, author, ts, prev, sig, id` met `rel ∈ {supports, contradicts, derives, cites, links}`; `from`/`to` zijn knit-id's (cross-field toegestaan).

**vote/1**: keys `vote/1, on, dir, author, ts, sig, id` met `dir ∈ {up, down}`; `on` = knit- of fiber-id.

## A5. Score-aggregatie (deterministisch, v1)

- Eén geldige stem per `(author, on)`: **laatste ts wint**; gelijke ts → laagste `id` lexicografisch wint.
- `score = Σ up − Σ down` (gewicht 1 voor iedereen in v1; reputatie is v2).
- `betwist` = true als `down/(up+down) ≥ 0,25` én totaal ≥ 8 stemmen.
- Sortering "score": score desc, dan ts desc, dan id asc. Volledig herberekenbaar uit de recordset — geen verborgen staat.

## A6. Build, deploy, feeds

`node src/build.mjs` → valideert alle configs tegen het schema, parseert seeds, verifieert elke sig, berekent scores, en schrijft `dist/`: `index.html` (hub), `/<slug>/index.html` per live/teaser field, `/stats.json` (fabric-strip: knits, fibers, peers-stub, weft-stub), `/<slug>/knits.json` (client-side search-index), `/feed.json` (uit CHANGELOG.md, voedt de devlog-strip). Records met ongeldige sig of canonicalisatie: **build faalt hard** — de build is de eerste auditor. Deploy: rsync `dist/` naar anchor + Hetzner; GitHub Pages als PR-preview.

---

## Runbook: nachtploeg-queue-volgorde

| Nacht | Issues | Reden |
|---|---|---|
| 1 | KW-001 → KW-002 (serieel) | fundament; 002 heeft 001 nodig |
| 2 | KW-003 ∥ KW-006 | CSS en crypto raken elkaar niet |
| 3 | KW-004 ∥ KW-007 | hub op 002/003; score op 006 |
| 4 | KW-005 | grootste UI-issue, alleen laten draaien |
| 5 | KW-008 ∥ KW-009 | ingest op 006/007; CI onafhankelijk |
| 6 | KW-010 + rework-buffer | mirrors/rapporten; restpunten uit reviews |

Reviewritme: wo-avond nachten 1–2 (goldens KW-006 = moment van waarheid), za-ochtend nachten 3–5 + chemfield-seed-curatie, zo-avond eerste nachtrapport-mp4 → devlog #1.
