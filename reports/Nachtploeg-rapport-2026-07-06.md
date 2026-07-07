# Nachtploeg-rapport 2026-07-06

*Gegenereerd uit git — alle punten zijn herleidbaar naar commits; geen samenvatting-door-model.*

## Commits (8)
- `bc2b4548` feat(field): KW-005 — §2.2 field page + local-sign submit form (closes #7) (#21) — Deve Luse (2026-07-06T23:56:00+02:00)
- `728318d1` feat(hub): KW-004 — full §2.1 hub page (closes #5) (#20) — Deve Luse (2026-07-06T23:53:49+02:00)
- `4ab75986` KW-007 · vote/1-aggregatie + score-engine (§A5) (#19) — Deve Luse (2026-07-06T13:53:50+02:00)
- `b3e43027` Add githfield.yml — link docs & backlog into githfield — Deve Luse (2026-07-06T13:33:22+02:00)
- `8598fafe` KW-003 · designtokens (foundry-dark) + componentstijlen + styleguide (#18) — Deve Luse (2026-07-06T12:14:30+02:00)
- `4ca37c1e` KW-006 · lib/fabric.ts: canonicalisatie, keccak/secp256k1, records + golden vectors (#17) — Deve Luse (2026-07-06T12:09:11+02:00)
- `50e19576` KW-002 · field.schema.json + validator + zes field-configs (#15) — Deve Luse (2026-07-06T11:39:24+02:00)
- `573fd933` KW-001 · Monorepo-scaffold + SSG-buildpijplijn (#11) — Deve Luse (2026-07-06T11:00:47+02:00)

## Issues/PR's aangeraakt
#5, #7, #11, #15, #17, #18, #19, #20, #21

## Diffstat
```
.gitignore                    |   2 +
 CHANGELOG.md                  |  12 +
 README.md                     |  11 +
 field.schema.json             |  30 +++
 fields/chemfield.field.json   |  10 +
 fields/codefield.field.json   |   8 +
 fields/energyfield.field.json |   8 +
 fields/gangfield.field.json   |   8 +
 fields/ledgerfield.field.json |   9 +
 fields/modelfield.field.json  |   8 +
 githfield.yml                 |  11 +
 package-lock.json             | 497 ++++++++++++++++++++++++++++++++++++++++++
 package.json                  |  21 ++
 seeds/.gitkeep                |   0
 src/build.mjs                 | 268 +++++++++++++++++++++++
 src/client/field.ts           | 154 +++++++++++++
 src/client/hub.ts             | 120 ++++++++++
 src/lib/.gitkeep              |   0
 src/lib/fabric.ts             | 155 +++++++++++++
 src/lib/score.ts              | Bin 0 -> 2471 bytes
 src/lib/validate.mjs          |  85 ++++++++
 src/pages/.gitkeep            |   0
 src/ui/.gitkeep               |   0
 static/styleguide.html        |  87 ++++++++
 static/svgg/.gitkeep          |   0
 static/tokens.css             | 104 +++++++++
 tests/build.test.mjs          |  42 ++++
 tests/fabric.test.mjs         | 135 ++++++++++++
 tests/score.test.mjs          | 103 +++++++++
 tests/styleguide.test.mjs     |  34 +++
 tests/validate.test.mjs       |  50 +++++
 31 files changed, 1972 insertions(+)
```

## Open vragen
- (handmatig aanvullen — het rapport bevat alleen git-feiten)
