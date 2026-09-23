# Architecture Rules

System-level architecture (context, building blocks, runtime, deployment, ADRs) is documented in
`docs/architecture/ARC42.md`. This file holds the rules Claude must follow when changing code.

## Layers

```
shared/schema.ts          ← single source of truth for tables, Zod schemas, TS types
server/
  db.ts                   ← SQLite connection, inline schema creation, seeding
  storage.ts              ← all DB access (façade — no Drizzle anywhere else)
  createApp.ts            ← app factory without listen() — used by tests and index.ts
  pdfParser.ts            ← PDF extraction + bank-specific parsers
  paperlessClient.ts      ← HTTP client for Paperless-ngx
  routes/                 ← one router per resource
client/src/
  lib/config.ts           ← API_BASE resolution + safeCssColor()
  lib/queryClient.ts      ← QueryClient, apiRequest()
  pages/                  ← one component per page
```

## Shared Schema — Single Source of Truth

`shared/schema.ts` defines Drizzle tables, Zod insert schemas, and TypeScript types. **All**
validation and types come from here — never duplicate them.

```
shared/schema.ts  →  server/routes/*.ts        (Zod .safeParse() at runtime)
                  →  client/src/pages/*.tsx    (z.infer<> for form types)
```

## Storage Façade — no direct Drizzle outside `storage.ts`

All database access goes through the `storage` object in `server/storage.ts`. No Drizzle queries
in route handlers, parsers, or any other file.

```typescript
// ✅ Correct
storage.getAccounts();
storage.createTransaction(data);

// ❌ Forbidden (outside server/storage.ts)
db.select().from(accounts).all();
```

## Domain Invariants

- `amount` in the DB is always positive; `type` (`income` / `expense` / `transfer`) carries the sign semantics
- Boolean-like DB columns (`isAdmin`, `totpEnabled`, …) are SQLite `0`/`1` integers, not booleans
- Use Zod `.safeParse()` for all external input — never `.parse()` (throws uncontrolled)

## Recipes

### New API endpoint

1. Create or update the REQ with Gherkin ACs (see `v-model.md`)
2. Write API tests in `tests/server/api/<feature>.test.ts`
3. New file `server/routes/<feature>.ts` — router + Zod validation
4. Register in `server/routes.ts`: `app.use("/api/<feature>", <feature>Router)`
5. Update ARC42 chapter 5 (Building Block View)

### New bank parser

1. Extend REQ-005 (PDF import) with the new bank's ACs
2. Unit tests with fixture text in `tests/server/unit/pdfParser.test.ts`
3. Extend `detectBank()` in `server/pdfParser.ts`
4. Add `parseXyz(text: string): ParsedTransaction[]`
5. Call it from `parsePDF()` before the generic fallback

### New database field

1. Extend the table definition in `shared/schema.ts`
2. Extend the Zod schema if needed (`.extend({})`)
3. Extend `CREATE TABLE IF NOT EXISTS` in `server/db.ts` — **no** migration tool, inline SQL;
   existing databases additionally need `tryExec("ALTER TABLE … ADD COLUMN …")` in `db.ts`
   (idempotent: the error for an already-existing column is ignored)
4. Update the `IStorage` interface and implementation in `server/storage.ts`
5. Adapt the route handlers

## Client

- Server state via React Query (`client/src/lib/queryClient.ts`); mutations go through `apiRequest()`
- Colors from the DB always pass through `safeCssColor()` before reaching `style` or SVG
  `fill`/`stroke` (see `security.md`)
- Interactive elements used by E2E tests carry a `data-testid` (scheme in `testing-practices.md`)
