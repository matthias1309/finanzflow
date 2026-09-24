# System Map — FinanzFlow

**Generated:** 2026-09-24 · **Source:** 16 REQs, 16 ARCHs · **Regenerate:** `/system-map`

> ⚠️ Generated artifact. Do not hand-edit — it will be overwritten. If a relationship here
> looks wrong, fix the underlying REQ/ARCH and regenerate. Treat this map as stale once any
> REQ/ARCH changes; regenerate before relying on it.

## Domain Clusters

### Auth & Access
- **REQs:** REQ-001 (Authentication & Access Control), REQ-013 (Two-Factor Authentication, TOTP),
  REQ-015 (Multi-User Management)
- **Shared architecture:** `users`, `recovery_codes` (and the legacy `app_settings` TOTP data,
  migrated once into `users` by `server/db.ts`); `server/auth.ts`, `server/session.ts`,
  `server/totp.ts`, `server/env-init.ts`, `server/env-defaults.ts`, `server/routes/auth.ts`,
  `server/routes/users.ts`; `/api/auth/*`, `/api/users/*`; `Login.tsx`, `TwoFactorSetup.tsx`,
  `Users.tsx`
- **Purpose:** Keep a publicly reachable household app closed to everyone but its users —
  password + TOTP login, sessions, admin-managed user accounts.

### Master Data
- **REQs:** REQ-002 (Account Management), REQ-003 (Category Management), REQ-004 (Transaction
  Management)
- **Shared architecture:** `accounts`, `categories`, `transactions`; `server/storage.ts`,
  `shared/schema.ts`, `server/routes/{accounts,categories,transactions}.ts`;
  `Accounts.tsx`, `Categories.tsx`, `Transactions.tsx`
- **Purpose:** CRUD for the three core entities every other feature reads or writes.

### Import
- **REQs:** REQ-005 (PDF Bank Statement Import), REQ-006 (Automatic Category Suggestion),
  REQ-011 (Batch Transaction Import), REQ-016 (Paperless Bank Statement Import)
- **Shared architecture:** `transactions` (write), `category_rules`, `paperless_account_mappings`,
  `paperless_imports`; `server/pdfParser.ts`, `server/paperlessClient.ts`,
  `server/routes/{pdf,categoryRules,paperless}.ts`, `POST /api/transactions/batch`,
  `POST /api/category-rules/learn`; `ImportPDF.tsx`, `ImportPaperless.tsx`
- **Purpose:** Get bank statement PDFs (upload or Paperless-ngx) into `transactions` with as
  little manual categorization as possible.

### Dashboard & Visualization
- **REQs:** REQ-007 (Dashboard & Financial Overview), REQ-008 (Account Visibility Toggle),
  REQ-009 (Sankey Cash Flow Diagram)
- **Shared architecture:** `GET /api/summary/:month` (`server/routes/summary.ts`);
  `Dashboard.tsx`, `SankeyChart.tsx`; `safeCssColor()` in `client/src/lib/config.ts`
- **Purpose:** Turn one month of transactions into KPIs and a money-flow diagram. Read-only.

### Navigation & UI Platform
- **REQs:** REQ-010 (Month Filtering & Navigation), REQ-012 (Dark / Light Theme), REQ-014
  (Mobile-Responsive UI)
- **Shared architecture:** `GET /api/months` (`server/routes.ts`), month query parameters on
  `/api/transactions` and `/api/summary/:month`; `Layout.tsx`, `ThemeContext.tsx`; Tailwind
  breakpoints and `dark` class
- **Purpose:** Cross-cutting UI behavior shared by all pages — month selection, theme, layout.

## Dependency Matrix

| REQ | Title | Builds on | Overlaps with | Supersedes |
|-----|-------|-----------|---------------|------------|
| REQ-001 | Authentication & Access Control | — | REQ-013, REQ-015 | HTTP Basic Auth (pre-REQ, removed) |
| REQ-002 | Account Management | — | REQ-004, REQ-007, REQ-008, REQ-016 | — |
| REQ-003 | Category Management | — | REQ-004, REQ-006, REQ-009 | — |
| REQ-004 | Transaction Management | REQ-002, REQ-003 | REQ-005, REQ-007, REQ-010, REQ-011 | — |
| REQ-005 | PDF Bank Statement Import | REQ-004 | REQ-006, REQ-011, REQ-016 | — |
| REQ-006 | Automatic Category Suggestion | REQ-003, REQ-005 | REQ-011, REQ-016 | — |
| REQ-007 | Dashboard & Financial Overview | REQ-004, REQ-010 | REQ-008, REQ-009, REQ-014 | — |
| REQ-008 | Account Visibility Toggle | REQ-007 | REQ-009 | — |
| REQ-009 | Sankey Cash Flow Diagram | REQ-007 | REQ-003, REQ-008, REQ-012 | — |
| REQ-010 | Month Filtering & Navigation | REQ-004 | REQ-007 | — |
| REQ-011 | Batch Transaction Import | REQ-004, REQ-005 | REQ-006, REQ-016 | — |
| REQ-012 | Dark / Light Theme | — | REQ-009, REQ-014 | — |
| REQ-013 | Two-Factor Authentication (TOTP) | REQ-001 | REQ-015 | — |
| REQ-014 | Mobile-Responsive UI | — | REQ-007, REQ-012 (all pages) | — |
| REQ-015 | Multi-User Management | REQ-001, REQ-013 | — | Single-user `APP_USER` model (extends, env user still synced) |
| REQ-016 | Paperless Bank Statement Import | REQ-005, REQ-006, REQ-011 | REQ-002 | — |

"Builds on" = hard dependency; "Overlaps with" = shared touchpoint. Explicit `REQ-XXX`
cross-references in the REQ bodies exist only for REQ-001↔013↔015 and REQ-016→005/006; all
other relationships are derived from shared tables, modules, and routes.

## Architecture Interplay (Touchpoint Index)

| Touchpoint | Type | Touched by |
|-----------|------|------------|
| `transactions` | table | REQ-003 (delete guard), REQ-004, REQ-005, REQ-007, REQ-009, REQ-010, REQ-011, REQ-016 |
| `accounts` | table | REQ-002, REQ-004, REQ-007, REQ-008, REQ-009, REQ-016 |
| `categories` | table | REQ-003, REQ-004, REQ-006, REQ-009 |
| `category_rules` | table | REQ-006, REQ-011, REQ-016 |
| `users` | table | REQ-001, REQ-013, REQ-015 |
| `recovery_codes` | table | REQ-013 |
| `app_settings` | table (legacy) | REQ-013 (one-time TOTP migration in `server/db.ts`) |
| `paperless_account_mappings`, `paperless_imports` | table | REQ-016 |
| `shared/schema.ts` | module | all server-side REQs (single source of truth) |
| `server/storage.ts` | module | REQ-002, REQ-003, REQ-004, REQ-006, REQ-013, REQ-015, REQ-016 |
| `server/pdfParser.ts` | module | REQ-005, REQ-016 |
| `server/auth.ts`, `server/session.ts` | module | REQ-001, REQ-015 |
| `server/routes/auth.ts` | module | REQ-001, REQ-013 |
| `server/env-init.ts` | module | REQ-001, REQ-015 |
| `server/routes/transactions.ts` | module | REQ-004, REQ-010, REQ-011 |
| `server/routes/summary.ts` (`GET /api/summary/:month`) | module / route | REQ-004 (transfer totals), REQ-007, REQ-008, REQ-009, REQ-010 |
| `server/routes/categoryRules.ts` (`POST /api/category-rules/learn`) | module / route | REQ-006, REQ-011, REQ-016 |
| `POST /api/transactions/batch` | route | REQ-005, REQ-011, REQ-016 |
| `GET /api/months` (`server/routes.ts`) | route | REQ-007, REQ-010 |
| `client/src/pages/Dashboard.tsx` | page | REQ-007, REQ-008, REQ-010, REQ-014 |
| `client/src/pages/Transactions.tsx` | page | REQ-004, REQ-010, REQ-014 |
| `client/src/components/SankeyChart.tsx` | component | REQ-009, REQ-012 |
| `client/src/components/Layout.tsx` | component | REQ-012, REQ-014 |
| `ImportPDF.tsx`, `ImportPaperless.tsx` | page | REQ-005/006/011, REQ-016 |
| Bilanz / Sparquote formula | calculation | REQ-007 (client), REQ-004 (server totals), REQ-008 (recomputed on filter) |
| `amount` positive / `type` carries sign | invariant | REQ-004, REQ-005, REQ-007, REQ-009, REQ-011 |
| Security middleware chain (`createApp.ts`) | crosscutting | REQ-001, REQ-013, REQ-015 (all `/api` routes depend on it) |

## Hotspots (change-risk)

- **`transactions` table** — touched by 8 REQs. Any column or invariant change ripples through
  import, dashboard, Sankey, and month navigation. The `amount`-positive invariant is currently
  **not enforced server-side** (AC-004-09 known issue) — fixing it affects every writer.
- **`GET /api/summary/:month`** — the single data source for REQ-007/008/009 and part of
  REQ-010; lacks month-format validation (AC-010-06 known issue). A change here is visible on
  the Dashboard and Sankey at once, and the client-side rendering above it has no E2E coverage.
- **REQ-004 (Transactions)** — 5 REQs build on it (REQ-005, REQ-007, REQ-010, REQ-011, and
  REQ-016 transitively). Three open implementation gaps (AC-004-06/09/10).
- **Import pipeline (REQ-005 → REQ-011 → REQ-006, reused by REQ-016)** — a four-REQ chain
  sharing `pdfParser.ts`, `/api/transactions/batch`, and `/learn`. The learn-batch
  all-or-nothing bug (AC-006-08/AC-011-06) affects both import paths.
- **Auth cluster (`server/auth.ts`, `env-init.ts`)** — only 3 REQs, but security-critical: the
  fail-open fallback secrets (AC-001-08) and the missing ownership check on
  `PATCH /api/users/:id/password` both live here.

## Coverage Notes

- **Dashboard & Visualization** (REQ-007/008/009) and **UI Platform** (REQ-010 UI parts,
  REQ-012, REQ-014) have essentially no automated client-side coverage — their TCs are
  `accepted` in the TEST-SPECs. The data underneath is covered server-side (TEST-004, TC-007-03).
- **REQ-014** is an explicit TDD exception (purely visual) — not an oversight.
- `recovery_codes`, `paperless_account_mappings`, and `paperless_imports` are each owned by a
  single REQ — no cross-feature risk.
- No orphan REQs: every REQ has at least one relationship.
- **Numbering:** REQ-001 … REQ-016, no gaps (per `REQ-INDEX.md`).
