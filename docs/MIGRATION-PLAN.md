# Migration Plan — FinanzFlow → Claude Code Template

**Created:** 2026-09-23
**Template:** https://github.com/matthias1309/template
**Status:** in progress — see checklist below

This file is the single source of truth for the migration. **Every migration session starts by
reading this file** and ends by updating the checklist and the session log at the bottom.

---

## Goal

Bring FinanzFlow onto the V-Model development template (REQ → ARCH → TEST-SPEC → TDD →
Implementation → Code Review) with full traceability, a green quality baseline, and the standard
`.claude/` setup — without changing application behavior.

## Decisions (2026-09-23)

| # | Decision | Consequence |
|---|---|---|
| D1 | **All repository content in English** | CLAUDE.md, rules, REQs, commit messages translated. German stays only where it is a real UI label / error message quoted in Gherkin (e.g. `"Importieren"`). |
| D2 | **Flatten `sankey-finance/` into the repo root** | `CLAUDE.md`, `docs/`, `.claude/` all at root as the template expects. Deployment (`rsync` to the Pi) must be adapted. |
| D3 | **ARCH + TEST-SPEC retrofitted 1:1 per REQ** | 16 ARCH + 16 TEST-SPEC documents. |
| D4 | **Retrofit IDs mirror the REQ number** | REQ-005 → ARCH-005 → TEST-005 → TC-005-YY. New features continue with the same alignment (REQ-017 → ARCH-017 …). |
| D5 | **ARC42 is kept** as the system-level architecture document (`docs/architecture/ARC42.md`) | ARCH-XXX documents hold feature-level design and link to ARC42 sections instead of duplicating them. ADRs stay in ARC42 chapter 9. |
| D6 | **Retrofit sessions document test gaps, they do not write new tests** | Gaps are collected in the "Test Gap Backlog" below and closed in Session 10. |
| D7 | **No CR documents for already-shipped features** | CR-XXX is required for all work from Session 11 on. |

## Template deviations (intentional)

Things taken from the template but adapted, because the template itself is inconsistent or
does not fit this project. Consider back-porting fixes to the template repo.

- `settings.json`: no pinned `model` (template pins the outdated `claude-sonnet-4-5`).
- `mcp.json`: not copied (template only contains placeholder servers).
- Hooks: post-edit hook actually runs `eslint` on the edited `.ts/.tsx` file (exit 2 feeds findings
  back to Claude) instead of only printing a hint; Prettier is not run by the hook until the tree is
  formatted (would reformat whole files); the pre-tool-use logging hook is dropped (no value).
- `settings.json`: no `env` block (template sets `NODE_ENV=development`, which would leak into
  `npm run build`/tests run by Claude); narrow allowlist instead of `Bash(git *)`/`Edit(**)`; deny
  list extended (force-push variants, `git reset --hard`, `git filter-repo`, reading `.env`/`*.db`).
- Commands: ARCH/TEST IDs mirror the REQ number (D4) instead of "next free ID"; paths adapted to
  `tests/` and `server/ client/ shared/`.
- Additional rule file `architecture.md` (shared schema, storage façade, recipes) — project-specific.
- `testing-practices.md`: tests stay in the `tests/` tree (not co-located next to sources).
- Function length: unified on **~30 lines** (template value) — decided by Matthias in Session 3.
  Max 3 parameters and "no flag parameters" kept from the old CLAUDE.md.
- `system-map.md`: removed the "Project_Buddy" / FEAT-lineage leftovers and the reference to an
  undefined "V-Model step 0 Impact Analysis"; instead `/new-requirement` and `v-model.md` tell
  Claude to consult `docs/SYSTEM-MAP.md` before writing a new REQ. (Back-port to template.)

---

## Session Checklist

Each session = one branch = one PR. Do not start a session before the previous PR is merged.
From Session 2 on, **CI must be green** before merge.

### Session 0 — Remove leaked secrets 🔴 urgent
Branch: `fix/remove-committed-secrets`
- [x] Delete `sankey-finance/secrets.env` from the repo, add `secrets.env` / `*.env` pattern to `.gitignore`
- [x] Decide whether to purge it from git history (`git filter-repo`) — repo is **public**
      → **Decision:** not purged now (would force-push a public repo); revisit after credential
      rotation if desired. Old values remain visible in history until then.
- [ ] **Manual (Matthias, on the Pi):** rotate `SESSION_SECRET`, `TOTP_ENCRYPTION_KEY`, admin password
      (→ new `APP_PASSWORD_HASH`). Rotating the TOTP key invalidates stored 2FA secrets →
      re-enroll 2FA (`npm run 2fa:reset`).
- [x] Note the incident in `.claude/rules/learnings.md` → done in Session 3

**Incident note (for Session 3 learnings.md):** `sankey-finance/secrets.env` (containing
`SESSION_SECRET`, `TOTP_ENCRYPTION_KEY`, `APP_PASSWORD_HASH`, etc.) was committed to the public
repo. Removed from tracking 2026-09-23 (PR for `fix/remove-committed-secrets`); history not yet
purged. Credentials must be rotated on the Pi (see checklist above) — history still contains the
old values until rotation + optional `git filter-repo`.

### Session 1 — Flatten repository layout
Branch: `chore/flatten-repo-root`
- [x] `git mv sankey-finance/* .` (incl. dotfiles), merge the two `.gitignore` files, root `README.md` absorbs the old one
      → there was no pre-existing root `.gitignore`, so `sankey-finance/.gitignore` was moved to root as-is
      (no merge needed); fixed its `documentation/tickets/` pattern to `docs/tickets/`.
- [x] Rename `documentation/` → `docs/` (content migration happens in Session 4; here only the move)
      → `documentation/CLAUDE.md` renamed to `docs/documentation-CLAUDE.md` to avoid clashing with the
      new root `CLAUDE.md` (Session 3 folds its content into `v-model.md` and removes this file).
      `documentation/tickets/` was untracked on disk (moved with plain `mv`, not `git mv`).
- [x] Adapt `DEPLOYMENT.md`: `rsync` from repo root with `--exclude` for `.git`, `.claude`, `docs`, `node_modules`, `tests`; fix backup/troubleshooting paths
      → also fixed two stray `.../finanzflow/sankey-finance/...` paths in the backup and 2FA-loop
      troubleshooting sections (pre-existing bug, now consistent with the flat deploy target), and a
      stale `sankey-finance_finanzflow_data` docker volume name in `DOCKER.md`.
- [x] Verify `docker build .` works locally from the new root → built successfully (`docker build -t finanzflow-flatten-test .`), image removed after.
- [ ] **Manual:** first deploy to the Pi with the new layout (data volume / `.env` paths unchanged on the Pi)

**Extra verification (not in original checklist):** `npm install` at the new root succeeds; `npm test`
→ 9/9 files, 125/125 tests pass (the previously-missing `better-sqlite3` native binding resolved
itself with the fresh install); `tsc --noEmit` shows the same 6 pre-existing baseline errors noted
in the Planning row below — no new errors from the flatten. Those 6 are fixed in Session 2.

### Session 2 — Quality baseline green ✅ done
Branch: `chore/quality-baseline`
- [x] Make tests runnable locally → binding already resolved after Session 1's fresh install; documented working Node version in `.nvmrc` (22, matches this dev machine; Docker stays on Node 18 for now — separate out-of-scope upgrade)
- [x] Fix the 6 `tsc` errors; add `typecheck` script
      → `tsconfig.json`: added `target: "ES2020"` (fixes 3× `Set` iteration errors on Dashboard.tsx, Transactions.tsx, storage.ts); `securityHeaders.ts`: unified the 3 CSP-directive branches to the same shape (all now include `baseUri`/`formAction`) instead of a union type mismatch; `routes/auth.ts`: removed the unused `/test-session` debug endpoint (wrote to a non-existent `SessionData.testValue` field, dead code, leaked session IDs via `console.log`)
- [x] Add ESLint (typescript-eslint flat config, `no-explicit-any` = error, react/react-hooks plugins) + Prettier; `lint`, `lint:fix`, `format` scripts — confirmed devDependencies with Matthias first
      → pinned `eslint@^9` (not v10 — `eslint-plugin-react` doesn't support it yet) and `eslint-plugin-react-hooks@^5` (not the new v7 "compiler" line — its config schema needs a `zod-validation-error` subpath the project's zod-validation-error@3 doesn't export, crashes ESLint on startup)
      → fixed all findings that surfaced (43 errors, 12 warnings): typed every `any` (mostly Supertest `res.body` in tests, React Query error handlers, the pdf2json error callback, the `AppError`-shaped Express error handler), removed dead imports/vars, memoized `SankeyChart`'s `colors`/`isDark` to satisfy `exhaustive-deps` without changing render frequency, converted `tailwind.config.ts` plugins from `require()` to ESM imports
      → in passing, fixed a real bug in `Users.tsx`'s `deleteMut.onError` (it fired a second, redundant `DELETE` request and ignored the result — unused-var lint on `res`/`id` led to spotting it)
      → Prettier is configured but the existing tree (122 files) was **not** reformatted — left for incremental/future cleanup per Matthias's call, to avoid a noise diff on top of the lint fixes
- [x] GitHub Actions CI: `.github/workflows/ci.yml` — install (`npm ci`) → typecheck → lint → `npm test` (E2E not included, as planned)
- [x] Rename package `rest-express` → `finanzflow` (`package.json` + regenerated `package-lock.json`)
- [x] Baseline: 125/125 Vitest tests passing, 0 tsc errors, 0 lint errors/warnings, `npm ci` verified clean

**Known pre-existing gap (not fixed, out of scope for this session):** `npm run build` fails locally on macOS with `No loader is configured for ".node" files: node_modules/fsevents/fsevents.node` (esbuild tries to bundle the optional, macOS-only `fsevents` transitive dependency because it isn't in the server bundle's `external` allowlist in `script/build.ts`). Confirmed this already fails on `main` before this session's changes — the Docker build path (Linux, no `fsevents` installed) is unaffected and was verified working in Session 1. Worth a follow-up chore.

### Session 3 — Claude Code infrastructure ✅ done
Branch: `chore/claude-template-setup`
- [x] Copy + adapt `.claude/rules/` (coding-style, testing-practices, git-workflow, v-model, security, learnings)
      → plus a new project-specific `architecture.md`
- [x] Move project-specific content out of the old CLAUDE.md files into rules:
      shared-schema / storage façade / recipes → `architecture.md`; TS standards → `coding-style.md`;
      security middleware table → `security.md` (the old table listed a non-existent `basicAuthMiddleware` —
      replaced by the real `requireAuth` / `requireAdmin` / `requireStepUp`); "Common pitfalls" → `learnings.md`
      (stale Node-25 note updated); `tests/CLAUDE.md` → `testing-practices.md`;
      `documentation/CLAUDE.md` (Gherkin rules, ARC42 update table, ADR format) → `v-model.md`
- [x] Copy + adapt `.claude/commands/` (all 9); paths → `docs/…`, `tests/…`, `server/ client/ shared/`
- [x] New root `CLAUDE.md` (English, slim, template structure) — deleted `tests/CLAUDE.md` and `docs/documentation-CLAUDE.md`
- [x] `settings.json`: clean permission allowlist (replaced the ad-hoc curl/docker entries), deny list, hooks
- [x] Hooks: post-edit ESLint on `.ts/.tsx`, script executable — verified manually (clean file → exit 0, `any` → exit 2 with findings)
- [x] `CLAUDE.local.md` (gitignored) with local notes (port 3000, AirPlay, Pi host); `.claude/settings.local.json` now gitignored too
- [x] Pre-commit Clean Code Review from the old CLAUDE.md → `git-workflow.md` (printed checklist) + `CR-TEMPLATE.md`
- [x] `CHANGELOG.md` workflow → `git-workflow.md` (new entries in English; old German entries stay as-is)

**Extra (security, found in passing):** `DEPLOYMENT.md` still contained the leaked `SESSION_SECRET` /
`TOTP_ENCRYPTION_KEY` values (and a SHA-256 admin hash) in its `.env` example → replaced with
placeholders. The same values are still **hardcoded as fallbacks** in `server/auth.ts`,
`server/env-init.ts`, `server/env-defaults.ts` → follow-up below (behavior change, not in scope here).
Matthias's untracked `.claude/settings.local.json` also contains these values in old `export …`
permission entries — clean up locally.

### Session 4 — Requirements migration
Branch: `docs/migrate-requirements`
- [ ] `docs/REQ/REQ-NNN-slug.md` → `docs/requirements/REQ-NNN.md` (16 files)
- [ ] Translate to English (REQ-016 and any German prose); keep quoted UI labels in German
- [ ] Add header: `Status: approved` (shipped features), `Created`, `Traced by: _(pending ARCH and TEST)_`
- [ ] Split each `Feature:` block into `### AC-NNN-YY: <name>` headings with one Gherkin scenario each
- [ ] Create `docs/requirements/REQ-INDEX.md` (replaces `REQ/README.md`), list numbering gaps (none expected)
- [ ] Move `ARC42.md` → `docs/architecture/ARC42.md`, fix all links (CLAUDE.md, rules, ARC42, CHANGELOG)
- [ ] Commit messages from now on: `… — REQ-XXX`

### Sessions 5–9 — ARCH + TEST-SPEC retrofit (1:1 per REQ)
Per REQ in the session:
1. `ARCH-NNN.md` — derived from code + the matching ARC42 sections (link, don't copy); `Traces: REQ-NNN`
2. `TEST-NNN.md` — one TC per AC; `File:` points to the existing test, or `❌ missing` if none
3. Add `// TC-NNN-YY` comments to the existing tests that verify an AC (no behavior changes)
4. Update `Traced by` in REQ and `Verified by` in ARCH
5. Append every `❌ missing` TC to the Test Gap Backlog below

| Session | Branch | REQs |
|---|---|---|
| 5 | `docs/retrofit-auth` | [ ] REQ-001 Authentication · [ ] REQ-013 2FA/TOTP · [ ] REQ-015 User management |
| 6 | `docs/retrofit-master-data` | [ ] REQ-002 Accounts · [ ] REQ-003 Categories · [ ] REQ-004 Transactions · [ ] REQ-008 Account visibility |
| 7 | `docs/retrofit-import` | [ ] REQ-005 PDF import · [ ] REQ-006 Category learning · [ ] REQ-011 Batch import |
| 8 | `docs/retrofit-paperless-dashboard` | [ ] REQ-016 Paperless import · [ ] REQ-007 Dashboard · [ ] REQ-009 Sankey chart |
| 9 | `docs/retrofit-ui` | [ ] REQ-010 Month navigation · [ ] REQ-012 Theme · [ ] REQ-014 Mobile responsive |

After Session 9: run `/traceability` → every REQ must show ARCH + TEST-SPEC ✅.

### Session 10 — Close test gaps
Branch: `test/close-retrofit-gaps`
- [ ] Prioritize the Test Gap Backlog (security + import first); write missing tests with TC comments
- [ ] Add `@vitest/coverage-v8`, coverage report in CI, threshold 80 % on `server/` business logic (confirm dependency)
- [ ] Remaining low-value gaps: mark as `accepted` with reason in the TEST-SPEC

### Session 11 — Acceptance & handover
Branch: `docs/migration-acceptance`
- [ ] `/traceability`, `/test-coverage`, `/system-map` → commit `docs/SYSTEM-MAP.md`
- [ ] First `CR-001` for the migration itself (using the template)
- [ ] `/capture-learning` for insights from the migration; back-port template fixes (see "Template deviations")
- [ ] Mark this plan `completed`

---

## Test Gap Backlog

_Filled during Sessions 5–9. Format: `TC-NNN-YY — short description — risk (high/med/low)`._

(empty)

## Out of Scope / Follow-ups

- Dockerfile uses `node:18-alpine` — Node 18 is EOL; upgrade (incl. `better-sqlite3` major) as a separate REQ-less chore after the migration.
- Unused shadcn/ui components and dependencies (`refactor-clean`) — separate cleanup PR.
- Automatic Paperless sync (see REQ-016 notes) — would be the first feature through the full V-Model.
- `npm run build` fails locally on macOS (`fsevents` .node binary, see Session 2 log) — pre-existing, Docker build unaffected.
- 🔴 **Hardcoded fallback secrets** in `server/auth.ts`, `server/env-init.ts`, `server/env-defaults.ts`
  (the leaked `SESSION_SECRET` / `TOTP_ENCRYPTION_KEY` values and default password hashes). If production
  env vars are missing, the app silently runs with publicly known secrets (fail-open). Should fail fast in
  production instead — needs a REQ-001 AC + tests; do right after the migration or as a hotfix.
- `CHANGELOG.md` history is German — translate or leave as historical record (new entries are English).
- Existing codebase (122 files) is not yet Prettier-formatted — `prettier --write .` deferred to avoid a large noise diff; do as its own PR.

---

## Session Log

| Date | Session | PR | Notes |
|---|---|---|---|
| 2026-09-23 | Planning | — | Assessment done, decisions D1–D7 recorded. Baseline: 6 tsc errors, 7/9 Vitest files fail locally (missing `better-sqlite3` binding), no CI, no lint. |
| 2026-09-23 | Session 0 | [#5](https://github.com/matthias1309/finanzflow/pull/5) | `secrets.env` removed from tracking + `.gitignore` updated. History purge deferred (would need force-push to public repo). Credential rotation on the Pi is still open — manual, Matthias. |
| 2026-09-23 | Session 1 | [#6](https://github.com/matthias1309/finanzflow/pull/6) | Repo flattened to root (`git mv` from `sankey-finance/`), `documentation/` → `docs/`, `DEPLOYMENT.md`/`DOCKER.md`/`.dockerignore` paths fixed. Verified: `npm install`, `docker build .`, `npm test` (125/125), `tsc --noEmit` (same 6 pre-existing baseline errors, none new). Pi redeploy with the new layout is still open — manual, Matthias. |
| 2026-09-23 | Session 2 | [#7](https://github.com/matthias1309/finanzflow/pull/7) | tsc 0 errors (added `target: "ES2020"`, fixed CSP directive typing, removed a dead `/test-session` debug endpoint). ESLint (flat config, `no-explicit-any`=error) + Prettier added; fixed all 43 lint errors / 12 warnings (typed all `any`, fixed a real double-DELETE bug in `Users.tsx` found via unused-var lint). GitHub Actions CI added (`typecheck` → `lint` → `test`). Package renamed `rest-express` → `finanzflow`. `.nvmrc` = 22. Prettier left unapplied to the existing tree (Matthias's call — avoid noise diff). Found pre-existing `npm run build` failure on macOS (`fsevents`, unrelated to this session, Docker build unaffected) — logged as a follow-up, not fixed. |
| 2026-09-23 | Session 3 | [#8](https://github.com/matthias1309/finanzflow/pull/8) | `.claude/` rules (7 incl. new `architecture.md`), 9 commands, post-edit ESLint hook, clean `settings.json`, `CR-TEMPLATE.md`, slim English root `CLAUDE.md`, gitignored `CLAUDE.local.md`. Old `tests/CLAUDE.md` + `docs/documentation-CLAUDE.md` folded in and deleted. Function limit unified to ~30 lines (Matthias). Found + fixed leaked secret values in `DEPLOYMENT.md`; hardcoded fallback secrets in server code logged as 🔴 follow-up. |
