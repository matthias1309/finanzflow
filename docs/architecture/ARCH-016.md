# ARCH-016 — Paperless Bank Statement Import

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-016
**Verified by:** TEST-016

## Summary

A second PDF source for the import pipeline from [ARCH-005](ARCH-005.md): instead of a browser
upload, the PDF buffer comes from the Paperless-ngx REST API. Bank detection, transaction
extraction, deduplication, and category suggestion ([ARCH-006](ARCH-006.md)) are reused unchanged;
saving still goes through the existing batch endpoint ([ARCH-011](ARCH-011.md)). See
`docs/architecture/ARC42.md` §6.5 (Paperless Import) and §8.1 ("Paperless API Token Handling").

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `paperlessRouter` | `server/routes/paperless.ts` | `/api/paperless/*` — mappings CRUD, document listing/classification, import (parse), confirm (mark imported) |
| `paperlessClient` | `server/paperlessClient.ts` | HTTP client against the Paperless REST API; typed error classes (`PaperlessConfigError`, `PaperlessUnreachableError`, `PaperlessAuthError`, `PaperlessApiError`) |
| `resolveDocument` | `server/routes/paperless.ts` | Classifies an open document as `resolved` / `unmapped` / `ambiguous` from its tags |
| `insertPaperlessAccountMappingSchema` | `shared/schema.ts` | Zod validation for `paperless_account_mappings` CRUD |
| `confirmSchema` | `server/routes/paperless.ts` | Validates `{ accountId: positive int }` for the confirm step |
| mapping/import storage functions | `server/storage.ts` | `getPaperlessMappings`, `createPaperlessMapping`, `updatePaperlessMapping`, `deletePaperlessMapping`, `getImportedPaperlessDocumentIds`, `recordPaperlessImport` |

**Mapping CRUD (AC-016-01, AC-016-02)**

`GET/POST/PUT/DELETE /api/paperless/mappings` — standard Zod-validated CRUD over
`paperless_account_mappings` (`paperlessTag` unique, FK to `accounts`), same shape as ARCH-002's
account CRUD.

**Document classification (AC-016-03 … AC-016-06)**

`GET /api/paperless/documents`:
1. `fetchKontoauszugDocuments()` — queries Paperless for documents tagged `"Kontoauszug"`.
2. Filters out any document ID already in `storage.getImportedPaperlessDocumentIds()`
   (AC-016-03, AC-016-08's "no longer appears" guarantee).
3. `resolveDocument` strips the `"Kontoauszug"` tag from each document's tag list and classifies
   the remainder: 0 other tags → `unmapped` (AC-016-05), exactly 1 tag → looked up in the
   `paperlessTag → accountId` map, `resolved` if found else `unmapped` (AC-016-04), `> 1` other
   tags → `ambiguous`, no lookup attempted (AC-016-06). Classification is purely tag-count-based,
   not string-similarity — matches REQ-016 Notes' explicit "no auto-matching by name similarity."

**Import (parse) and confirm (AC-016-07, AC-016-08)**

`POST /api/paperless/documents/:id/import` downloads the PDF (`downloadDocument`) and runs it
through the *same* `parsePDF` (ARCH-005) and `storage.suggestCategory` (ARCH-006) used by the
manual upload path — same 10s timeout guard, same response shape (`{ bank, transactions, rawText,
errors }` plus `suggestedCategoryId` per transaction). `POST /api/paperless/documents/:id/confirm`
does **not** save transactions itself — it only validates `accountId` and calls
`storage.recordPaperlessImport`, marking the document as imported. The actual transaction
persistence happens through the client calling the existing `POST /api/transactions/batch` and
`POST /api/category-rules/learn` (ARCH-011/ARCH-006) — REQ-016 Notes explicitly calls this out as
intentional reuse, not a gap.

**Error mapping (AC-016-09, AC-016-10)**

`respondPaperlessError` maps each typed `paperlessClient` error to an HTTP status:
`PaperlessConfigError → 503`, `PaperlessUnreachableError → 502`, `PaperlessAuthError → 401`,
`PaperlessApiError → 502`. Any other thrown error is re-thrown (caught by the route's own
try/catch on `/import`, or bubbles to the global error handler on `/documents`). This gives the
client a reliable way to distinguish "Paperless isn't configured," "Paperless is down," and
"the token is wrong" — matching AC-016-09/AC-016-10's distinct user-facing messages.

## Key Decisions

- **Reuse `parsePDF`/`suggestCategory` unchanged, only swap the PDF source** — the entire
  bank-detection and category-suggestion pipeline (ARCH-005/ARCH-006) is byte-source-agnostic; a
  `Buffer` is a `Buffer` whether it came from `multer` or `downloadDocument`. Avoids duplicating
  parsing logic between REQ-005 and REQ-016, per REQ-016 Notes.
- **`confirm` only marks the document imported, it doesn't save transactions** — keeps
  `paperlessRouter` from re-implementing `transactionsRouter`'s batch-save/partial-success logic;
  the client already has a working two-request save-then-learn flow from REQ-011/ARCH-011 and
  simply reuses it with Paperless-sourced data.
- **Tag-count classification, not fuzzy name matching** — an explicit, auditable mapping table
  (`paperless_account_mappings`) is safer than string-similarity heuristics for financial account
  assignment, where a wrong guess means transactions land in the wrong account.

## Out of Scope

- The manual-upload PDF pipeline itself — [ARCH-005](ARCH-005.md).
- Category learning — [ARCH-006](ARCH-006.md).
- The batch save and learn calls the client makes after `/import` — [ARCH-011](ARCH-011.md).
- Automatic background sync — explicitly deferred to a future REQ per REQ-016 Notes.

## Open Questions

None — REQ-016 is the best-tested REQ retrofitted so far (see TEST-016); all mapping CRUD, all
three document-classification outcomes, both error-mapping paths, the import-preview shape, and
the confirm step have direct API test coverage.
