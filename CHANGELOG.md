# Changelog

- KW-009: CI/CD + PR-hygiëne — `ci.yml` (test→lint→license-check→build, één Node-20, enkel `actions/*`), `deploy.yml` (main-only rsync-over-ssh via `webfactory/ssh-agent`, geen silent failure, concurrency-guard), eslint minimal flat-config (`.mjs`), `tools/license-check.mjs` (prod-deps whitelist MIT/Apache/BSD/ISC/…), PR-template (changelog+issue-ref verplicht), `docs/ops.md` (branch-protection-checklist + secrets), CI-badge in README. Sluit #9.
- KW-008 acc.2: `vank-report`-adapter — `tools/vank-adapter.mjs` parseert `vank.report.v1` (producer/grant/events) → ongetekende concept-knits in `seeds/_drafts/`, elk met source `vank:<event-id>` en `CURATIE-VEREIST`. Corrupt/ongeldig report → nette fout. Geen auto-signeren, geen auto-ingest. Sluit #8.
- KW-008 acc.1: getekende seeds — offline curator-keypair (secp256k1) tekent elke knit; `build` verifieert fabric-sig tegen de gedeclareerde `signer` en faalt hard bij manipulatie/ontbrekende sig. Private key blijft lokaal (`~/.knitweb-curator/`, chmod 600, gitignored); alleen de pubkey staat in de seed. Tools: `curator-key.mjs`, `sign-seed.mjs`. chemfield-seed ondertekend (author b43a0712…). (#8)
- KW-008: ingest v1 — build leest seeds/<slug>.knits.json → per-field knits.json + echte fabric-strip-tellingen (stats.json). chemfield-seed: 21 gesourcede knits + 108 fibers (uit ChemField/openchem, geen verzinsels). Signed .f1 + vank-adapter = follow-up. (#8)
- KW-005: field-pagina §2.2 — top-knits + sort (score/nieuw/betwist §A5), fiber-placeholder, knit-indienen-form met canonieke knit/1-preview + keccak-digest en lokale secp256k1-signing (IndexedDB) → .f1-download; XSS-veilig, werkt met 0 knits. (#7)
- KW-004: hub-pagina §2.1 — hero, live fabric-strip (stats.json), teaser-badged field-grid, explorer-teaser client-search over knits.json, config-constant footerlinks. (#5)
Elke merge één regel (feed-bron voor KW-010).

- KW-007 · lib/score.ts: deterministische §A5 stem-aggregatie (LWW per (author,on), ts-tiebreak op id) + score/betwist; permutatie-invariant, 10k votes < 50 ms.

- KW-003 · static/tokens.css: foundry-dark designtokens + componentklassen (.field-card/.knit-card/.vote-widget/.hash/.strip/.badge-status), per-field --accent, prefers-reduced-motion; dist/styleguide.html in 3 accents.
- KW-006 · lib/fabric.ts: §A4-canonicalisatie (NFC, escaping, vaste keyvolgorde) + keccak256/secp256k1 sign/verify voor knit/1·fiber/1·vote/1; bevroren golden vectors + 200× fuzz.
- KW-002 · field.schema.json (§A3) + compacte validator (geen schema-lib) + 6 field-fixtures; build valideert configs volledig, foutmeldingen noemen pad+veld.
- KW-001 · Monorepo-scaffold + SSG-buildpijplijn: `node src/build.mjs` → `dist/`, esbuild-only, build-smoketests groen.
