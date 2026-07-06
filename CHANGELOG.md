# Changelog

Elke merge één regel (feed-bron voor KW-010).

- KW-007 · lib/score.ts: deterministische §A5 stem-aggregatie (LWW per (author,on), ts-tiebreak op id) + score/betwist; permutatie-invariant, 10k votes < 50 ms.

- KW-003 · static/tokens.css: foundry-dark designtokens + componentklassen (.field-card/.knit-card/.vote-widget/.hash/.strip/.badge-status), per-field --accent, prefers-reduced-motion; dist/styleguide.html in 3 accents.
- KW-006 · lib/fabric.ts: §A4-canonicalisatie (NFC, escaping, vaste keyvolgorde) + keccak256/secp256k1 sign/verify voor knit/1·fiber/1·vote/1; bevroren golden vectors + 200× fuzz.
- KW-002 · field.schema.json (§A3) + compacte validator (geen schema-lib) + 6 field-fixtures; build valideert configs volledig, foutmeldingen noemen pad+veld.
- KW-001 · Monorepo-scaffold + SSG-buildpijplijn: `node src/build.mjs` → `dist/`, esbuild-only, build-smoketests groen.
