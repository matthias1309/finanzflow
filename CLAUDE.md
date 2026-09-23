# CLAUDE.md — Project Instructions for Claude Code

Primary system prompt for Claude Code in this repository. Committed and shared; personal and
machine-specific notes go into `CLAUDE.local.md` (gitignored).

---

## Project Overview

**Project Name:** FinanzFlow
**Purpose:** Personal finance dashboard for German bank accounts (N26, DKB, ING). Imports bank
statement PDFs (upload or from Paperless-ngx), categorizes transactions, and visualizes money
flows (Sankey chart, monthly dashboard).
**Primary Audience:** One household — few users, self-hosted
**Status:** Active development — currently being migrated onto the V-Model template
(`docs/MIGRATION-PLAN.md`; read it first in every migration session)

---

## Tech Stack

| Layer        | Technology                                                  |
|--------------|-------------------------------------------------------------|
| Language     | TypeScript 5.x (strict)                                     |
| Runtime      | Node.js 22 locally (`.nvmrc`), Node 18 in the Docker image  |
| Frontend     | React 18 SPA, Vite, Tailwind, shadcn/ui, React Query, D3    |
| Backend      | Express 5                                                   |
| Database     | SQLite (`better-sqlite3`) via Drizzle ORM                   |
| Validation   | Zod (schemas in `shared/schema.ts`)                         |
| Testing      | Vitest + Supertest (unit/API), Playwright (E2E)             |
| Linting      | ESLint (typescript-eslint, flat config) + Prettier          |
| CI/CD        | GitHub Actions (typecheck → lint → test)                    |
| Deployment   | Docker on a Raspberry Pi, HTTPS (see `DEPLOYMENT.md`)       |

---

## Key Conventions

All coding and workflow conventions live in `.claude/rules/`. Read them before writing or
modifying code.

- **Coding style:** `.claude/rules/coding-style.md`
- **Architecture rules (shared schema, storage façade, recipes):** `.claude/rules/architecture.md`
- **Testing practices:** `.claude/rules/testing-practices.md`
- **Git workflow, CHANGELOG, pre-commit review:** `.claude/rules/git-workflow.md`
- **V-Model & traceability, REQ/Gherkin/ARC42 conventions:** `.claude/rules/v-model.md`
- **Security:** `.claude/rules/security.md`
- **Project learnings & known pitfalls:** `.claude/rules/learnings.md`

When in doubt, follow the existing patterns in the codebase rather than inventing new ones.
If a convention is unclear, ask before proceeding.

---

## Common Commands

```bash
npm install              # install dependencies (Node version from .nvmrc)
PORT=3000 npm run dev    # dev server — port 3000, NOT 5000 (macOS AirPlay occupies it)
npm run build            # production build
npm test                 # Vitest: unit + API tests
npm run test:watch       # Vitest watch mode
npm run test:e2e         # Playwright E2E (starts its own server on port 3001)
npm run typecheck        # tsc --noEmit
npm run lint             # ESLint
npm run lint:fix         # ESLint with auto-fix
npm run 2fa:reset        # reset 2FA for a user
```

Always run `typecheck`, `lint`, and `test` before considering a task complete.

---

## Project Structure

```
shared/schema.ts        # single source of truth: Drizzle tables, Zod schemas, TS types
server/                 # Express API: createApp, db, storage façade, parsers, routes/
client/src/             # React SPA: pages/, components/, lib/
tests/
  server/unit/          # Vitest unit tests
  server/api/           # Vitest + Supertest API tests
  e2e/                  # Playwright specs
docs/
  REQ/                  # requirements (legacy layout → docs/requirements/ in migration Session 4)
  architecture/ARC42.md # system-level architecture (arc42) incl. ADRs
  code-reviews/         # CR-XXX review documents + CR-TEMPLATE.md
  MIGRATION-PLAN.md     # template migration: checklist, decisions, session log
.claude/                # rules/, commands/ (slash commands), hooks/, settings.json
```

---

## Language

- **All repository content is written in English** — code, comments, rules, commands, docs,
  commit messages, new CHANGELOG entries.
- Exception: real German UI labels and error messages (quoted verbatim in Gherkin).
- Conversation with the developer may happen in any language; the repository stays English.

---

## Important Notes

- **Never commit secrets.** The repo is public. Use environment variables; `.env.example`
  documents names with placeholders only. See `.claude/rules/security.md`.
- **Never disable or bypass the security middleware** (`securityHeadersMiddleware`,
  `authRateLimiter`, `csrfProtectionMiddleware`, `requireAuth`, `requireAdmin`).
- **Never force-push to `main`.** One branch + one PR per change; CI must be green before merge.
- **V-Model first:** REQ → ARCH → TEST-SPEC → tests → implementation → CR. See `.claude/rules/v-model.md`.
- **Before adding a dependency**, check whether the functionality already exists and confirm
  with the developer.
- **Database schema changes** are inline SQL in `server/db.ts` (no migration tool) and must be
  backwards-compatible with the existing production database on the Pi.
- **Keep this file up to date** when the stack or conventions change.

---

## Architecture Notes

- All DB access goes through `server/storage.ts`; all types and validation come from
  `shared/schema.ts` (details: `.claude/rules/architecture.md`).
- `server/createApp.ts` builds the app without `listen()` so tests can use Supertest directly.
- Auth and CSRF are bypassed when `APP_PASSWORD_HASH` is unset or `NODE_ENV=test` — intentional.
- `amount` is always positive; `type` (`income` / `expense` / `transfer`) carries the sign.
- System-level architecture and ADRs: `docs/architecture/ARC42.md`.

---

## Out of Scope (ask first)

- Major dependency upgrades (e.g. Node in the Dockerfile, `better-sqlite3`, `otplib` v13)
- Changing the deployment setup on the Pi (`DEPLOYMENT.md`, `docker-compose.yml.example`)
- Reformatting the whole tree with Prettier (planned as its own PR)
- Rewriting git history (e.g. purging leaked secrets) — needs an explicit decision
