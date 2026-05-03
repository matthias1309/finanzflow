# FinanzFlow — Software Architecture (Arc42)

**Version:** 1.2  
**Date:** 2026-05-03  
**Status:** Current  

---

## Table of Contents

1. [Introduction and Goals](#1-introduction-and-goals)
2. [Architecture Constraints](#2-architecture-constraints)
3. [System Scope and Context](#3-system-scope-and-context)
4. [Solution Strategy](#4-solution-strategy)
5. [Building Block View](#5-building-block-view)
6. [Runtime View](#6-runtime-view)
7. [Deployment View](#7-deployment-view)
8. [Crosscutting Concepts](#8-crosscutting-concepts)
9. [Architecture Decisions](#9-architecture-decisions)
10. [Quality Requirements](#10-quality-requirements)
11. [Risks and Technical Debt](#11-risks-and-technical-debt)
12. [Glossary](#12-glossary)

---

## 1. Introduction and Goals

### 1.1 Requirements Overview

FinanzFlow is a **personal finance dashboard** for a single user managing German bank accounts (N26, DKB, ING). It provides:

- **PDF import** of bank statements with automatic transaction parsing
- **Category management** with a learning system that auto-suggests categories on repeat imports
- **Account management** with per-account visibility control
- **Dashboard** showing KPIs (total income / expenses) and a Sankey cash-flow diagram
- **Month navigation** to review any historical month with data
- **Dark/light theme** toggle that adapts all UI including chart colors

### 1.2 Quality Goals

| Priority | Quality Attribute | Scenario |
|---|---|---|
| 1 | Security | Only the authorized user can access any data; no credentials or financial data leak |
| 2 | Correctness | Imported transactions match the bank statement; amounts and dates are parsed accurately |
| 3 | Operability | The application runs reliably on Uberspace shared hosting without a DBA or DevOps team |
| 4 | Maintainability | A single developer can understand, extend, and test all components |
| 5 | Performance | The dashboard renders within 1 second for up to 12 months of data |

### 1.3 Stakeholders

| Role | Concern |
|---|---|
| End User (sole user) | Secure access, correct financial data, convenient import |
| Developer (sole developer) | Clean codebase, testability, easy deployment |
| Uberspace Hosting | Stable process, bounded resource usage, supervisord compatibility |

---

## 2. Architecture Constraints

### 2.1 Technical Constraints

| Constraint | Rationale |
|---|---|
| **Node.js / TypeScript** throughout | Single-language stack minimizes context switching |
| **SQLite** as database | No dedicated DB server required; Uberspace provides no managed DB |
| **Uberspace shared hosting** | No root access, no Docker, no custom ports below 1024 |
| **CJS bundle for production** | esbuild compiles server to CJS (`dist/index.cjs`) for maximum Node.js compatibility |
| **Single user only** | Session-based auth + TOTP supports exactly one credential pair (via env vars); no user table needed |
| **No client-side persistence of sensitive data** | Theme state lives in React state only; no localStorage, no cookies beyond the session cookie |

### 2.2 Organisational Constraints

| Constraint | Rationale |
|---|---|
| **Solo developer** | Architecture must be understandable without team documentation |
| **German locale** | All amounts use `1.234,56 €` format; dates use `DD.MM.YYYY`; UI language is German |
| **Offline-capable import** | PDF parsing happens entirely server-side; no third-party OCR service |

### 2.3 Conventions

- TypeScript `strict: true` everywhere
- Zod schemas are the single source of truth for validation — shared between server (runtime) and client (type inference)
- All database access goes through the `storage` façade — no raw SQL outside `db.ts`
- Colors stored in the DB are validated via `safeCssColor()` before use in SVG `fill`/`stroke` attributes

---

## 3. System Scope and Context

### 3.1 Business Context

```
┌──────────────────────────────────────────────────────────────┐
│                        FinanzFlow                            │
│                                                              │
│  ┌────────────────┐    ┌──────────────────────────────────┐  │
│  │  Browser (SPA) │◄──►│  Express API + SQLite DB         │  │
│  │  React + D3    │    │  (single Node.js process)        │  │
│  └────────────────┘    └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
        ▲                          ▲
        │                          │
   User uploads             PDF bank statements
   bank PDFs &              parsed server-side
   reviews data
```

| External Entity | Interaction | Direction |
|---|---|---|
| **User / Browser** | HTTP(S) requests to REST API; renders React SPA | Bidirectional |
| **Bank PDF (N26 / DKB / ING)** | Uploaded via `POST /api/import/pdf`; parsed server-side | Inbound |
| **OS `prefers-color-scheme`** | Read once at startup to determine initial theme | Inbound |
| **Uberspace Supervisor** | Starts/stops the Node.js process; routes traffic via `uberspace web backend` | Outbound |

### 3.2 Technical Context

```
Browser
  │  HTTPS (port 443 via Uberspace reverse proxy)
  │  Session cookie (httpOnly, Secure, SameSite=Strict)
  ▼
Uberspace Apache reverse proxy
  │  Forwards /finanzflow/* → Node.js process (port 3001)
  ▼
Express 5 server (Node.js)
  │  Serves React SPA (static files from dist/public/)
  │  Handles /api/* routes
  ▼
SQLite (finance.db, local file)
```

**Interfaces:**

| Interface | Protocol | Format |
|---|---|---|
| Browser ↔ Server | HTTP/1.1 with session cookie | JSON (API), HTML/JS/CSS (SPA) |
| Server ↔ SQLite | better-sqlite3 (synchronous FFI) | Binary SQLite |
| User → Server | `multipart/form-data` | PDF upload |

---

## 4. Solution Strategy

### 4.1 Technology Decisions

| Decision | Choice | Alternative Considered |
|---|---|---|
| Frontend framework | React 18 with React Query | Vue, Svelte |
| Backend framework | Express 5 | Fastify, Hono |
| Database | SQLite + Drizzle ORM | PostgreSQL, MySQL |
| Styling | Tailwind CSS 3 + shadcn/ui | MUI, Chakra UI |
| Charting | D3.js + d3-sankey | Recharts, Chart.js |
| PDF parsing | pdf2json (server-side) | pdfjs-dist (client-side), cloud OCR |
| Build tool | Vite 7 (client) + esbuild (server) | webpack, Rollup |
| Type safety | Zod + drizzle-zod (shared schemas) | Manual types, io-ts |

### 4.2 Top-Level Architecture Decisions

1. **Monorepo with shared types** — `shared/schema.ts` exports Zod schemas and TypeScript types consumed by both client and server, eliminating duplication and ensuring runtime validation matches static types.

2. **Façade pattern for storage** — All DB access goes through the `storage` object (`server/storage.ts`), which implements `IStorage`. This makes the storage layer swappable and mockable in tests without touching business logic.

3. **React Query as client-side cache** — All server state is managed by React Query with `staleTime: Infinity`. Mutations explicitly invalidate only the relevant query keys, giving fine-grained cache control without a global store.

4. **Security-first middleware stack** — Helmet (CSP, HSTS, X-Frame-Options), Basic Auth with bcrypt + timing-safe comparison, CSRF Origin/Referer check, and rate limiting are applied globally before any route handler.

5. **Testable app factory** — `server/createApp.ts` exports a `createApp()` function that builds the Express app without starting a listener, enabling Supertest-based API tests without a running server.

---

## 5. Building Block View

### 5.1 Level 1 — Overall System

```
┌─────────────────────────────────────────────────────────────┐
│                        FinanzFlow                           │
│                                                             │
│  ┌──────────────┐      ┌────────────────────────────────┐  │
│  │   Client     │◄────►│         Server                 │  │
│  │  (React SPA) │      │  (Express 5 + TypeScript)      │  │
│  └──────────────┘      └───────────────┬────────────────┘  │
│                                        │                    │
│                         ┌──────────────▼──────────────┐    │
│                         │       Database               │    │
│                         │       (SQLite)               │    │
│                         └─────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Level 2 — Client

```
client/src/
├── App.tsx                   Root — router, providers (QueryClient, Toaster)
├── lib/
│   ├── config.ts             API_BASE resolution, safeCssColor()
│   └── queryClient.ts        QueryClient factory, apiRequest() helper
├── pages/
│   ├── Dashboard.tsx         KPI cards, account visibility toggle, Sankey chart
│   ├── Accounts.tsx          Account CRUD (create, edit, delete)
│   ├── Categories.tsx        Category CRUD with edit dialog
│   ├── Transactions.tsx      Transaction list, filter by month
│   ├── ImportPDF.tsx         PDF upload, transaction preview, batch confirm
│   └── not-found.tsx         404 fallback
└── components/
    └── ui/                   shadcn/ui primitives (Button, Dialog, Select, …)
```

**Key client dependencies:**

| Component | Responsibility |
|---|---|
| `queryClient.ts` | Central `apiRequest()` wraps `fetch` with `API_BASE` prefix; `getQueryFn` used as default React Query fetcher |
| `Dashboard.tsx` | Computes `filteredSummary` (visibility-filtered account data) in a `useMemo`, passes it to `SankeyChart` |
| `ImportPDF.tsx` | Uploads PDF → receives parsed preview → user confirms → `POST /api/transactions/batch` → `POST /api/category-rules/learn` |

### 5.3 Level 2 — Server

```
server/
├── index.ts          Entry point: createApp() + listen() + vite/static setup
├── createApp.ts      App factory (no listen) — used by tests and index.ts
├── auth.ts           requireAuth middleware, authRateLimiter, safeStringEqual
├── session.ts        express-session configuration (memorystore, cookie flags)
├── totp.ts           TOTP secret encryption/decryption (AES-256), token verification
├── securityHeaders.ts helmet CSP (dev/prod split), csrfProtectionMiddleware
├── db.ts             SQLite connection + PRAGMA foreign_keys + schema migration + category seeding
├── storage.ts        IStorage interface + implementation (Drizzle ORM façade)
├── pdfParser.ts      PDF text extraction + bank-specific + generic parsers
├── static.ts         Production static file serving from dist/public/
├── vite.ts           Vite dev server in middleware mode
└── routes/
    ├── auth.ts             POST /api/auth/login, /totp, /logout, 2FA management
    ├── accounts.ts         GET/POST/PUT/DELETE /api/accounts
    ├── categories.ts       GET/POST/PUT/DELETE /api/categories
    ├── transactions.ts     GET/POST/PATCH/PUT/DELETE + POST /batch
    ├── summary.ts          GET /api/summary/:month → Sankey data
    ├── categoryRules.ts    GET /api/category-rules + POST /learn
    └── pdf.ts              POST /api/import/pdf (multer, pdf2json)
```

**Component responsibilities:**

| Component | Responsibility |
|---|---|
| `createApp.ts` | Assembles middleware stack + registers routes; returns `{ app, httpServer }` |
| `db.ts` | Opens SQLite, runs `CREATE TABLE IF NOT EXISTS` migrations, seeds default categories |
| `storage.ts` | Thin Drizzle ORM wrapper — all queries, no business logic |
| `pdfParser.ts` | `parsePDF(buffer)` → detects bank → runs bank-specific parser → deduplicates → returns `ParseResult` |
| `summary.ts` | Aggregates transactions by account and category for a given month; shapes data for the Sankey diagram |
| `categoryRules.ts` | Learns keyword→category mappings from confirmed imports; applies longest-match rule on suggestion |

### 5.4 Level 2 — Database

```
┌──────────────┐      ┌─────────────────┐
│   accounts   │◄─────│  transactions   │
│              │      │                 │
│ id (PK)      │      │ id (PK)         │
│ name         │      │ month (YYYY-MM) │
│ bank         │      │ date            │
│ color        │      │ description     │
│ type         │      │ amount          │
│ iban         │      │ account_id (FK) │
└──────────────┘      │ category_id(FK) │
                      │ type            │
┌──────────────┐      │ transfer_to_acc │
│  categories  │◄─────│ import_source   │
│              │      │ original_text   │
│ id (PK)      │      └─────────────────┘
│ name         │
│ type         │      ┌─────────────────┐
│ color        │      │ category_rules  │
└──────────────┘      │                 │
                      │ id (PK)         │
                      │ keyword (UNIQUE) │
                      │ category_id     │
                      │ hits            │
                      └─────────────────┘
```

**Schema notes:**

- `transactions.amount` is always positive; `type` (`income` / `expense` / `transfer`) determines sign semantics
- `transactions.transfer_to_account_id` is set only for `type = 'transfer'`; these rows are excluded from income/expense aggregation
- Foreign key constraints are enforced via `PRAGMA foreign_keys = ON` (set in `db.ts` at startup); referential integrity is guaranteed by the DB engine
- Schema migration is inline in `db.ts` using `CREATE TABLE IF NOT EXISTS` — no migration tool needed for a single-user app

---

## 6. Runtime View

### 6.1 User Login

```
Browser                     Express                       SQLite
  │                           │                              │
  │── GET /finanzflow/ ───────►│                              │
  │                           │ sessionMiddleware: no cookie  │
  │◄── 302 /login ────────────│                              │
  │                           │                              │
  │── GET /login ─────────────►│                              │
  │◄── 200 (Login-Page HTML) ─│                              │
  │                           │                              │
  │ Nutzer gibt User+Passwort ein                             │
  │── POST /api/auth/login ───►│                              │
  │                           │ authRateLimiter checks IP    │
  │                           │ bcrypt.compareSync(pass,hash)│
  │                           │ session.pendingTotp = true   │
  │◄── 200 { step: "totp" } ──│                              │
  │                           │                              │
  │ Nutzer gibt TOTP-Code ein  │                              │
  │── POST /api/auth/totp ────►│                              │
  │                           │── SELECT totp_secret ───────►│
  │                           │ totp.verify(code, secret)    │
  │                           │ session.authenticated = true │
  │◄── 200 { ok: true } ──────│                              │
  │                           │                              │
  │── GET /finanzflow/ ───────►│                              │
  │                           │ sessionMiddleware: valid ✓   │
  │◄── 200 (SPA HTML) ────────│                              │
```

### 6.2 Dashboard Load

```
Browser (React)             Server                   SQLite
  │                           │                         │
  │── GET /api/months ────────►│                         │
  │                           │── SELECT DISTINCT month ►│
  │                           │◄── ["2026-04","2026-03"] │
  │◄── ["2026-04","2026-03"] ─│                         │
  │                           │                         │
  │── GET /api/summary/2026-04►│                         │
  │                           │── SELECT transactions ──►│
  │                           │── SELECT categories ────►│
  │                           │── SELECT accounts ──────►│
  │                           │   buildAccountSummaries()│
  │◄── SummaryData JSON ──────│                         │
  │                           │                         │
  │ React renders:            │                         │
  │   KPI cards               │                         │
  │   D3 Sankey diagram       │                         │
```

### 6.3 PDF Import

```
Browser                     Server                      SQLite
  │                           │                            │
  │── POST /api/import/pdf ───►│                            │
  │   (multipart, PDF file)   │ multer: 20 MB limit        │
  │                           │ extractPDFText(buffer)     │
  │                           │ detectBank(text)           │
  │                           │ parseN26 / parseDKB /      │
  │                           │   parseGeneric             │
  │                           │ suggestCategory(desc)  ────►│ (category_rules)
  │◄── ParseResult JSON ──────│                            │
  │                           │                            │
  │ User reviews & assigns    │                            │
  │ categories                │                            │
  │                           │                            │
  │── POST /api/transactions/batch ──────────────────────► │
  │   [{ month, description, amount, … }]                  │
  │◄── { created, skipped, errors } ──────────────────────│
  │                           │                            │
  │── POST /api/category-rules/learn ────────────────────►│
  │   [{ description, categoryId }]                        │
  │◄── { learned: N } ────────────────────────────────────│
```

### 6.4 Category Learning (Detail)

`learnCategoryRules()` in `storage.ts` extracts a normalized keyword from each description using `extractKeyword()`:

1. Strip common German words (stopwords: "bei", "von", "für", "an", …)
2. Lower-case and trim
3. Take the first meaningful token with length ≥ 3
4. If keyword already exists in `category_rules`: increment `hits`, update `categoryId`
5. If new: insert with `hits = 1`

On the next import, `suggestCategory(description)` does a substring scan over all stored keywords. The longest matching keyword wins (more specific beats more general). Ties are broken by `hits` count.

---

## 7. Deployment View

### 7.1 Local Development

```
Developer Machine
  │
  ├── npm run dev
  │     PORT=3000 tsx server/index.ts
  │
  │  ┌─────────────────────────────────────────┐
  │  │  Node.js process (tsx, ESM)             │
  │  │                                         │
  │  │  Express 5                              │
  │  │  ├── Vite dev middleware                │
  │  │  │   (React Fast Refresh, HMR)          │
  │  │  ├── /api/* routes                      │
  │  │  └── auth disabled (no PASSWORD_HASH)   │
  │  │                                         │
  │  │  finance.db (local file)                │
  │  └─────────────────────────────────────────┘
  │
  └── Browser → http://localhost:3000
```

**Dev environment variables:**

| Variable | Development Default | Purpose |
|---|---|---|
| `PORT` | `5000` (use `3000` to avoid macOS AirPlay conflict) | HTTP listen port |
| `NODE_ENV` | `development` | Enables Vite middleware, relaxes CSP, skips auth |
| `DB_PATH` | `finance.db` | SQLite file path |
| `APP_PASSWORD_HASH` | — (unset) | Auth bypassed when unset in non-production |

### 7.2 Production (Uberspace)

```
Internet
  │  HTTPS
  ▼
Uberspace Apache (shared, port 443)
  │  Reverse proxy: /finanzflow/* → localhost:3001
  ▼
supervisord
  │  Manages process lifecycle
  ▼
Node.js process (node dist/index.cjs)
  │
  ├── Serves static files from dist/public/
  │   (React SPA, pre-built by Vite)
  │
  ├── Handles /finanzflow/api/* routes
  │
  └── finance.db (SQLite, persistent file on Uberspace home)
```

**Build pipeline:**

```
npm run build
  │
  ├── Vite builds client
  │   DEPLOY_BASE=/finanzflow/
  │   VITE_API_BASE=/finanzflow
  │   → dist/public/ (HTML, JS bundles, CSS, assets)
  │
  └── esbuild bundles server
      entry: server/index.ts
      format: CJS → dist/index.cjs
      external: better-sqlite3, pdf2json (native modules)
```

**Production environment variables (supervisord .ini):**

| Variable | Example Value | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Enables static serving, strict CSP, auth enforcement |
| `PORT` | `3001` | Internal port (Uberspace web backend) |
| `DB_PATH` | `/home/user/finanzflow/finance.db` | Persistent SQLite file |
| `APP_USER` | `admin` | Basic Auth username |
| `APP_PASSWORD_HASH` | `$2b$10$...` | bcrypt hash of the password |
| `APP_ORIGIN` | `https://user.uberspace.de` | CSRF allowed origin |

**Deployment package structure:**

```
finanzflow-uberspace.tar.gz
├── dist/
│   ├── index.cjs          Server bundle
│   └── public/            React SPA (static assets)
├── node_modules/          Production dependencies only
│                          (better-sqlite3, pdf2json with native binaries)
└── package.json
```

---

## 8. Crosscutting Concepts

### 8.1 Security

**Authentication**

Session-based two-factor authentication (see ADR-007). The flow:

1. `POST /api/auth/login` — password step
   - `authRateLimiter` checks IP (10 failures / 15 min)
   - Constant-time username comparison via `timingSafeEqual` with fixed-size buffers
   - Password verification via `bcrypt.compareSync`
   - On success: `req.session.pendingTotp = true` (session not yet fully authenticated)

2. `POST /api/auth/totp` — TOTP step
   - Decrypts stored TOTP secret (AES-256)
   - `totp.verify({ token, secret })` with ±1 window (30 s drift tolerance)
   - Replay protection: last-used token timestamp stored in DB
   - Recovery code path: bcrypt-compare against stored hashes; code marked used on match
   - On success: `req.session.authenticated = true`

3. Session middleware on all protected routes
   - Checks `req.session.authenticated === true`
   - Bypassed when `APP_PASSWORD_HASH` is unset (development / test mode)
   - On failure: `302 /login` (HTML requests) or `401` (API requests)

**Brute-Force Protection**

`authRateLimiter` (express-rate-limit): 10 failed requests per IP per 15 minutes before returning 429. `skipSuccessfulRequests: true` means only failed logins count.

**CSRF Protection**

`csrfProtectionMiddleware` checks `Origin` or `Referer` headers on all mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`). Header values are parsed with `new URL()` to prevent prefix-matching bypasses (e.g. `https://example.com.evil.com` would pass a naive `startsWith`). In development (`NODE_ENV !== 'production'`), the check is skipped.

**Content Security Policy**

Helmet sets a strict CSP. Two profiles:

| Directive | Development | Production |
|---|---|---|
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval'` | `'self'` |
| `style-src` | `'self' 'unsafe-inline' fonts.googleapis.com` | `'self' 'unsafe-inline'` |
| `connect-src` | `'self' ws://localhost:*` | `'self'` |
| `frame-src` | `'none'` | `'none'` |
| `object-src` | `'none'` | `'none'` |

The relaxed dev profile is required for Vite React Fast Refresh (needs `unsafe-inline` + `unsafe-eval`) and Google Fonts.

**Input Validation**

All route handlers validate request bodies with Zod schemas via `.safeParse()`. Validation errors return `400` with the flattened Zod error structure — never raw stack traces.

**CSS Injection Prevention**

Colors stored in the DB are validated against `/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/` by `safeCssColor()` before being interpolated into SVG `fill`/`stroke` attributes.

**ReDoS Prevention**

PDF parser regex patterns use bounded quantifiers (`.{1,100}`, `.{1,300}`) instead of unbounded `.*` or `.+`. The `ACCOUNT_HOLDER_PATTERN` environment variable (user-supplied regex) is length-limited to 500 characters and wrapped in a try/catch.

**Rate Limiting on Batch Endpoints**

Both `POST /api/transactions/batch` and `POST /api/category-rules/learn` are limited to 20 requests per IP per 15 minutes.

### 8.2 Error Handling

**Server errors:**

- All route handlers use synchronous Express handlers (no async without catch). Zod `.safeParse()` avoids try/catch in happy paths.
- The global Express error handler (`app.use((err, req, res, next) => …)`) catches unhandled errors:
  - `4xx` errors: original message forwarded (safe — validation errors, not system internals)
  - `5xx` errors: generic `"Ein interner Fehler ist aufgetreten."` — no stack traces, paths, or system info leaked

**Client errors:**

- `apiRequest()` in `queryClient.ts` calls `throwIfResNotOk(res)` on every response. Non-2xx responses throw an `Error` with the status code and body text.
- React Query propagates errors to the component via `isError` / `error`. Components show toast notifications on mutation failure.

### 8.3 Logging

Request logging is minimal and safe:
```
GET /api/summary/2026-04 200 in 12ms
```
- Only `/api/*` paths are logged (no auth challenges logged, which would leak credential attempts)
- Path is sanitized with `.replace(/[\r\n]/g, "_")` to prevent log injection via CRLF sequences
- No request bodies or query parameters are logged (no PII / financial data in logs)

### 8.4 Type Safety

**Shared schema pattern:**

```
shared/schema.ts
  ├── Drizzle table definitions (source of truth for DB schema)
  ├── drizzle-zod insertSchema (runtime validation)
  └── TypeScript types (static checks)
       ↓ imported by both:
  server/routes/*.ts          client/src/pages/*.tsx
  (Zod .safeParse at runtime)  (z.infer<> for form types)
```

This ensures a single change in `shared/schema.ts` propagates to both validation and type checks without manual synchronization.

### 8.5 Theme

Theme state lives in React component state in the root `App.tsx`. It is not persisted (refreshing resets to OS preference). The active theme is applied by toggling the `dark` class on `document.documentElement`. Tailwind CSS reads this class to switch between `:root` and `.dark` CSS variable sets.

Chart colors (Sankey diagram) are passed as props from the theme-aware parent component, with two distinct palettes:

| Color | Dark mode | Light mode |
|---|---|---|
| Income flows | `#6daa45` | `#15803d` |
| Expense flows | `#f87171` | `#dc2626` |
| Transfer flows | `#4f98a3` | `#4f98a3` |
| Node labels | `#c9c8c6` | `#374151` |

### 8.6 Testing Strategy

**Two layers:**

| Layer | Tool | Isolation | Coverage |
|---|---|---|---|
| Unit + API | Vitest + Supertest | Per-file in-memory SQLite (`pool: 'forks'`) | pdfParser helpers, all REST endpoints |
| E2E | Playwright | Separate SQLite file (`/tmp/finanzflow_e2e.db`), port 3001 | Critical user journeys (accounts, categories, dashboard) |

**Test isolation mechanism:**
- `tests/server/setup.ts` sets `process.env.DB_PATH = ':memory:'` and `NODE_ENV = 'test'` before any module is evaluated
- `vitest.config.ts` uses `pool: 'forks'` — each test file runs in its own process, so `db.ts` is evaluated fresh with the correct `DB_PATH`
- Auth and CSRF are automatically bypassed in `NODE_ENV = 'test'` (same as development mode)

---

## 9. Architecture Decisions

### ADR-001 — SQLite instead of a client-server database

**Context:** FinanzFlow has a single user and runs on Uberspace shared hosting, which provides no managed PostgreSQL or MySQL.

**Decision:** Use SQLite via `better-sqlite3` with Drizzle ORM.

**Consequences:**
- ✅ Zero infrastructure: no separate DB process, no connection pool, no credentials for the DB
- ✅ Synchronous API (`better-sqlite3`) simplifies server code — no async/await needed for DB calls
- ✅ Entire database is a single file, trivially backed up
- ⚠️ Cannot scale to multiple concurrent writers (not a requirement)
- ⚠️ No native JSON column type (acceptable — JSON is stored as text where needed)

---

### ADR-002 — HTTP Basic Auth instead of session-based login *(superseded by ADR-007)*

**Context:** The application needs to protect a single user's financial data.

**Decision:** HTTP Basic Auth with bcrypt password hashing and timing-safe comparison.

**Consequences:**
- ✅ Stateless — no session store needed, compatible with Uberspace memory limits
- ✅ Browser natively prompts for credentials on 401 — no custom login page required
- ✅ `bcrypt.compareSync` is inherently slow (10 rounds), making brute force impractical
- ⚠️ Credentials are sent on every request (mitigated by HTTPS on Uberspace)
- ⚠️ No "logout" mechanism — browser caches credentials until closed (acceptable for single-user)

> **Superseded by ADR-007.** HTTP Basic Auth does not support a second authentication factor. Replaced by session-based auth + TOTP.

---

### ADR-003 — Server-side PDF parsing

**Context:** Banks provide account statements as PDF files. Text must be extracted and parsed into structured transactions.

**Decision:** Parse PDFs server-side using `pdf2json`, with bank-specific parsers for N26, DKB, and ING, and a generic fallback.

**Consequences:**
- ✅ No sensitive financial data sent to third-party OCR services
- ✅ Full control over parsing logic; can be unit tested with fixture texts
- ✅ No client-side PDF library weight (pdf2json is a server dependency)
- ⚠️ Parser must be maintained per bank layout change
- ⚠️ Only works for selectable-text PDFs (not scanned images)

---

### ADR-004 — Monorepo with shared TypeScript types

**Context:** Client and server must agree on request/response shapes and validation rules.

**Decision:** `shared/schema.ts` exports Drizzle table definitions, Zod insert schemas, and TypeScript types. Both client and server import from `@shared/*`.

**Consequences:**
- ✅ Single source of truth for data shapes — a schema change in one place propagates to both
- ✅ Zod schemas provide runtime validation on the server and type inference on the client
- ⚠️ Server and client are coupled at the type level — breaking schema changes require updating both sides simultaneously (acceptable for a solo project)

---

### ADR-005 — Testable app factory (`createApp`)

**Context:** Integration tests need to create an Express app bound to an in-memory database without starting a real HTTP server.

**Decision:** Extract `server/createApp.ts` that returns `{ app, httpServer }` without calling `listen()`. `server/index.ts` calls `createApp()` and then adds `listen()` and Vite/static setup.

**Consequences:**
- ✅ Supertest tests call `createApp()` and pass `app` directly — no port conflicts, no process startup
- ✅ `setupFiles` in Vitest set `DB_PATH=:memory:` before any module runs, so each test file gets an isolated fresh database
- ✅ Auth and CSRF are automatically bypassed in test mode (same logic as dev)

---

### ADR-007 — Session-based authentication with TOTP (replaces ADR-002)

**Context:** HTTP Basic Auth (ADR-002) sends credentials on every request and provides no mechanism for a second authentication factor. A personal finance application on a public URL warrants stronger protection.

**Decision:** Replace HTTP Basic Auth with session-based authentication and TOTP as a mandatory second factor.

- Login page (`GET /login`) collects username + password; on success the session is marked `pendingTotp: true`
- TOTP page collects a 6-digit code (or recovery code); on success the session is marked `authenticated: true`
- Session cookie flags: `httpOnly`, `Secure`, `SameSite=Strict`; TTL configurable via `SESSION_MAX_AGE_HOURS` (default 8 h)
- TOTP secret encrypted at rest with AES-256 (`TOTP_ENCRYPTION_KEY` env var)
- 8 single-use recovery codes generated at setup, stored as bcrypt hashes
- Auth bypassed when `APP_PASSWORD_HASH` is unset (development / test mode)

**Consequences:**
- ✅ Credentials sent only once at login, not on every request
- ✅ Explicit logout possible (server-side session destruction)
- ✅ Second factor (TOTP) defeats credential-only attacks
- ✅ Recovery codes prevent permanent lockout if TOTP device is lost
- ⚠️ Server-side session store required (memorystore with TTL — already a dependency)
- ⚠️ TOTP_ENCRYPTION_KEY must be kept secret and backed up; loss requires CLI 2FA reset

---

### ADR-006 — esbuild CJS bundle for production server

**Context:** The server is written in ESM TypeScript. Uberspace runs Node.js ≥ 18. `better-sqlite3` and `pdf2json` are native CJS modules.

**Decision:** esbuild compiles `server/index.ts` → `dist/index.cjs` with `format: 'cjs'`, externalizing native modules.

**Consequences:**
- ✅ Single file deployment — fast startup, no tsx / ts-node required in production
- ✅ Native modules (better-sqlite3, pdf2json) remain as-is in `node_modules`
- ⚠️ `import.meta.url` is unavailable in CJS — worked around in `pdfParser.ts` with `typeof require !== 'undefined' ? require : createRequire(import.meta.url)`
- ⚠️ esbuild emits a harmless warning about `import.meta` in CJS mode

---

## 10. Quality Requirements

### 10.1 Security

| Scenario | Measure |
|---|---|
| Attacker guesses password via brute force | Rate limiter: 10 attempts / 15 min per IP → 429 |
| Attacker times username/password comparison | `timingSafeEqual` with fixed-size buffers |
| CSRF via malicious website | Origin/Referer check on all mutating requests |
| XSS via stored category name or description | React escapes all string interpolations; `safeCssColor()` for SVG attributes |
| Malicious PDF causes ReDoS | Bounded regex quantifiers; `ACCOUNT_HOLDER_PATTERN` length + try/catch |
| Information leak via error message | 5xx responses return only `"Ein interner Fehler ist aufgetreten."` |
| Password hash exposure via environment | `APP_PASSWORD_HASH` is in supervisord config, not in source code or DB |

### 10.2 Correctness

| Scenario | Measure |
|---|---|
| German amount `1.234,56` parsed incorrectly | `parseGermanAmount()` unit-tested with 6 cases |
| Date `16.03.26` (2-digit year) misinterpreted | `parseGermanDate()` applies century heuristic (>50 → 1900s) |
| Duplicate transactions from re-import | Deduplication by `date|description|amount` key before returning `ParseResult` |
| Transaction type mismatch | Zod `transactionTypeSchema` (`"income" | "expense" | "transfer"`) enforced on every write |
| Amount sign ambiguity | `amount` is always stored positive; `type` field carries the sign semantics |

### 10.3 Operability

| Scenario | Measure |
|---|---|
| Server crashes on Uberspace | supervisord auto-restarts the process |
| DB file permissions | SQLite file owned by the Uberspace user; no world-readable permissions |
| Node.js version mismatch | `better-sqlite3@latest` includes prebuilt binaries for Node ≥ 18 |
| Deployment with wrong API base | `VITE_API_BASE` baked into client bundle at build time; checked post-deploy via `curl` |

### 10.4 Maintainability

| Scenario | Measure |
|---|---|
| Adding a new bank parser | Add a `parseXYZ()` function in `pdfParser.ts`, extend `detectBank()`, call from `parsePDF()` |
| Adding a new API endpoint | Add a router file in `server/routes/`, register in `server/routes.ts` |
| Adding a new table | Add to `shared/schema.ts` (types + Zod schema), add `CREATE TABLE IF NOT EXISTS` in `db.ts`, add storage methods |
| Running tests | `npm test` (50 Vitest tests, ~700 ms) |

---

## 11. Risks and Technical Debt

### Risk 1 — PDF parser fragility

**Likelihood:** Medium  
**Impact:** High  

Banks change their PDF layout without notice. A layout change can cause the parser to silently produce zero results or misparse amounts.

**Mitigation:**
- Bank-specific parsers are isolated functions — only the affected parser needs updating
- `ParseResult.errors` array is shown in the UI so the user knows parsing failed
- Generic fallback parser catches common patterns

**Accepted debt:** No automated fixture-based regression tests for actual bank PDFs (would require maintaining sample PDFs). Manual verification after bank statement format changes.

---

### Risk 2 — Single-process SQLite under concurrent load

**Likelihood:** Very Low (single user)  
**Impact:** Low  

SQLite serializes writes. If multiple tabs send concurrent mutations, one will block briefly. `better-sqlite3` uses a synchronous API, so there is no connection pool.

**Mitigation:** Not mitigated — the design intentionally accepts this limitation for a single-user app. If multi-user support were required, a migration to PostgreSQL would be necessary.

---

### Risk 3 — Theme state not persisted

**Likelihood:** High (will occur on every reload)  
**Impact:** Low  

The current theme (dark/light) is stored only in React state. A page reload resets to the OS preference. This is by design (per REQ-012 Notes) but may feel inconsistent to users who manually toggle the theme.

**Mitigation:** Not mitigated. Persisting to `localStorage` would be a one-line change if the requirement changes.

---

### Risk 4 — Basic Auth credential caching by browser *(mitigated)*

**Likelihood:** N/A — resolved  
**Impact:** N/A — resolved  

Previously: browsers cached Basic Auth credentials with no explicit logout mechanism.

**Mitigation:** Resolved by ADR-007. Session-based auth with explicit logout (`POST /api/auth/logout`) destroys the server-side session and clears the cookie.

---

### Technical Debt

| Item | Description | Effort |
|---|---|---|
| No pagination on `/api/transactions` | Returns all transactions for a month. May be slow for accounts with thousands of entries. | Medium |
| No input sanitization on `description` | Descriptions from PDFs and manual input are stored and returned as-is. React escaping prevents XSS, but very long descriptions could cause layout issues. | Low |
| `staleTime: Infinity` in React Query | Data is never refetched automatically. Works fine for a single user, but a second tab would show stale data after mutations. | Low |
| `'unsafe-inline'` in production `style-src` | `ChartStyle` in `chart.tsx` injects a `<style>` tag via `dangerouslySetInnerHTML` to set CSS custom properties for both light and dark mode (`.dark [data-chart=…]`). This cannot be replaced by `style=""` attributes. Fix requires CSP nonces (`style-src-elem 'nonce-…'` + `style-src-attr 'unsafe-inline'`) threaded from Express through the HTML into `ChartStyle`. **Accepted risk:** chart colors originate from the DB, are validated by a strict color regex before storage and before rendering — no user-supplied free text reaches the CSS output. The attack path (SQL-injection → poisoned color → CSS exfiltration) is blocked by Drizzle + Zod upstream. | Medium |

---

## 12. Glossary

| Term | Definition |
|---|---|
| **Sankey diagram** | A flow chart where the width of each band is proportional to the flow quantity. FinanzFlow uses it to visualize money flowing from income categories through accounts to expense categories. |
| **KPI** | Key Performance Indicator. In FinanzFlow: total monthly income and total monthly expenses per account. |
| **IBAN** | International Bank Account Number. A standardized bank account identifier used in Europe. Stored optionally per account. |
| **Basic Auth** | HTTP Basic Authentication. Credentials are Base64-encoded and sent in the `Authorization` header on every request. Superseded by session-based auth + TOTP (ADR-007). |
| **bcrypt** | A password hashing algorithm with a configurable cost factor. Used to store the application password hash and recovery code hashes. |
| **TOTP** | Time-based One-Time Password (RFC 6238). Generates a 6-digit code every 30 seconds from a shared secret. Used as the second factor in 2FA. |
| **2FA** | Two-Factor Authentication. Requires two independent proofs of identity: something you know (password) and something you have (TOTP device). |
| **Session cookie** | An `httpOnly`, `Secure`, `SameSite=Strict` cookie that carries a session ID. The session state (authenticated, pendingTotp) is stored server-side in memorystore. |
| **Recovery code** | A single-use backup code generated during 2FA setup. Allows login if the TOTP device is unavailable. Stored as bcrypt hashes; invalidated on use. |
| **CSP** | Content Security Policy. An HTTP header that restricts which resources a browser may load, mitigating XSS. |
| **CSRF** | Cross-Site Request Forgery. An attack where a malicious site triggers a state-changing request to the victim site using the browser's cached credentials. |
| **ReDoS** | Regular Expression Denial of Service. An attack that causes catastrophic backtracking in poorly written regex, freezing the server. |
| **drizzle-orm** | A TypeScript ORM for SQLite/PostgreSQL/MySQL. Used for type-safe query building; does not run migrations at startup. |
| **drizzle-zod** | Companion library that generates Zod validation schemas from Drizzle table definitions. |
| **esbuild** | A fast JavaScript/TypeScript bundler. Used to compile the Express server to a single CJS file for production. |
| **Vite** | A frontend build tool and dev server. Used in middleware mode during development so the Express server handles both API and SPA requests. |
| **tsx** | A TypeScript executor that runs `.ts` files directly via Node.js (used in development). |
| **supervisord** | A process control system used on Uberspace to keep the Node.js process running and restart it on crash. |
| **YYYY-MM** | The month string format used throughout FinanzFlow for grouping transactions (e.g. `"2026-04"`). |
| **PDF2JSON** | A Node.js library that extracts raw text from PDF files. Used for bank statement parsing. |
| **category rule** | A learned keyword→category mapping. Stored in `category_rules` table. Applied automatically on the next PDF import to pre-suggest categories. |
| **transfer** | A transaction of `type = "transfer"` that moves money between two own accounts. Shown as a horizontal band in the Sankey diagram; excluded from income/expense totals. |
| **Uberspace** | A German shared hosting provider running on Linux, with supervisord and Apache reverse proxy. |
