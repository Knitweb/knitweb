# Ops — CI, deploy & branch-protection (KW-009)

De CI/CD-lane gebruikt uitsluitend `actions/*` + `webfactory/ssh-agent`. Geen andere
third-party actions zonder motivatie (SPEC §A6-grens).

## Activatie (één stap — vereist `workflow`-scope)
De twee workflow-bestanden staan versie-gecontroleerd onder **`ops/workflows/`** omdat de
agent-token geen `workflow`-scope heeft (GitHub weigert dan pushes naar `.github/workflows/`).
Activeer ze met een token dat die scope wél heeft:

```sh
gh auth refresh -h github.com -s workflow    # eenmalig, opent browser-bevestiging
mkdir -p .github/workflows
git mv ops/workflows/ci.yml ops/workflows/deploy.yml .github/workflows/
git commit -m "ci: activeer ci.yml + deploy.yml" && git push
```

Of plak de twee bestanden via de GitHub-UI (`Add file → Create new file` →
`.github/workflows/ci.yml`), die heeft de scope al. De README-badge wordt groen zodra
`ci.yml` op `main` staat.

## Pijplijn
- **`ci.yml`** — op elke PR en push naar `main`: `npm ci` → `test` → `lint` → `license-check` → `build`. Eén Node-LTS (20).
- **`deploy.yml`** — alleen op `main` (+ handmatig via `workflow_dispatch`): bouwt `dist/` en `rsync`t over SSH naar de anchor en de Hetzner-mirror. Faalt hard (geen silent failure); `concurrency` voorkomt overlappende deploys.

## Vereiste repo-secrets (Edwin zet de waarden — de agent ziet ze nooit)
| Secret | Betekenis |
|--------|-----------|
| `DEPLOY_SSH_KEY` | private deploykey (ed25519) met toegang tot beide targets |
| `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan`-output van anchor + Hetzner (host-key pinning) |
| `ANCHOR_DEST` | rsync-doel anchor, bv. `user@anchor:/srv/knitweb/` |
| `HETZNER_DEST` | rsync-doel Hetzner-mirror, bv. `user@hetzner:/var/www/knitweb/` |

`environment: production` (deploy-job) mag je met required reviewers beschermen.

## Branch-protection op `main` (handmatig — checklist voor Edwin)
`Settings → Branches → Add rule`, pattern `main`:
- [ ] **Require a pull request before merging** (≥1 approval; agent-PR's worden door jou gereviewd).
- [ ] **Require status checks to pass** → selecteer **`build`** (de `ci.yml`-job). "Require branches to be up to date" aan.
- [ ] **Require conversation resolution** aan.
- [ ] **Do not allow bypassing** (of enkel voor jezelf, bewust).
- [ ] Optioneel: **Require signed commits**.
- [ ] `Settings → Actions → General`: workflow-permissions op **read**, tenzij een job meer nodig heeft.

## Pages-preview per PR
Preview-deploys lopen via de bestaande Pages-flow (chemfield.github.io-patroon); een
per-PR-preview is een vervolg-issue zodra Pages-secrets staan.

## Mirrors, nachtrapport & devlog (KW-010)
- **`ops/workflows/mirrors.yml`** — op elke main-merge: `git push --mirror` naar GitLab + anchor-git (secrets `GITLAB_REMOTE`, `ANCHOR_GIT_REMOTE`, `MIRROR_SSH_KEY`, `MIRROR_KNOWN_HOSTS`). **Radicle-fallback:** `rad` is in GitHub-CI meestal onhaalbaar (geen node/identity) → de rad-stap is `continue-on-error` en de echte Radicle-mirror loopt via **anchor-cron** (`rad push` op de anchor, die de main-branch trackt).
- **`tools/nightly-report.mjs`** — `node tools/nightly-report.mjs [YYYY-MM-DD]` → `reports/Nachtploeg-rapport-<datum>.md` **uitsluitend uit git-feiten** (commits, diffstat, issue-refs); geen model-samenvatting.
- **`feed.json`** — de build genereert `dist/feed.json` uit `CHANGELOG.md`; de hub toont hem als Devlog-strip.
- **`reports/render.sh [out.mp4]`** — ffmpeg-diff-slideshow van ≥1 nachtrapport → 60–90 s mp4 voor de shorts-pipeline. **Geen auto-upload** (bewust handmatig).
