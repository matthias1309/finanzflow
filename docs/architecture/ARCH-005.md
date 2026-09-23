# ARCH-005 — PDF Bank Statement Import

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-005
**Verified by:** TEST-005

## Summary

Server-side parsing of uploaded bank-statement PDFs (N26, DKB, generic fallback) into a
transaction preview, with per-transaction category suggestions from the learning system
([ARCH-006](ARCH-006.md)). The confirmed transactions are then saved via the batch endpoint
([ARCH-011](ARCH-011.md)). See `docs/architecture/ARC42.md` §6.3 (PDF Import) for the sequence
diagram and §8.1 for ReDoS/upload-safety notes.

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `pdfRouter` | `server/routes/pdf.ts` | `POST /api/import/pdf` — upload, validate, parse, suggest categories |
| `multer` (memory storage) | `server/routes/pdf.ts` | Multipart upload handling; `fileFilter` rejects non-PDF MIME types, `limits.fileSize` enforces 20 MB (AC-005-04, AC-005-05) |
| `pdfRateLimiter` | `server/routes/pdf.ts` | 10 uploads / 15 min per IP (AC-005-10) — no test-env skip, unlike `authRateLimiter` |
| `parsePDF` | `server/pdfParser.ts` | Orchestrates: extract text → `detectBank` → bank-specific parser → generic fallback → dedup |
| `detectBank` | `server/pdfParser.ts` | Keyword/BIC matching against `rawText`; returns `"N26"`, `"DKB"`, `"ING"`, or `"Sonstige"` |
| `parseN26`, `parseDKB`, `parseGeneric` | `server/pdfParser.ts` | Bank-specific line parsers, regex-bounded (`.{1,100}`) to prevent ReDoS |
| `parseGermanAmount`, `parseGermanDate` | `server/pdfParser.ts` | Locale-specific number/date parsing shared by all parsers |

**Upload validation (AC-005-04, AC-005-05, AC-005-06)**

1. `multer`'s `fileFilter` rejects any MIME type outside `{application/pdf, application/x-pdf}`.
2. Magic-byte check (`req.file.buffer.slice(0, 5) === "%PDF-"`) in `pdfRouter` — rejects a
   renamed non-PDF file even if its MIME type was spoofed to `application/pdf`.
3. `parsePDF` wraps `extractPDFText` in try/catch; a corrupted PDF that passes the magic-byte
   check but fails to parse returns `{ transactions: [], errors: [...] }` with a user-facing
   message rather than throwing — the route handler's own catch is a second layer for anything
   `parsePDF` itself doesn't handle (e.g. the 10s timeout race).
4. A 10-second processing timeout (`Promise.race`) guards against a PDF that parses technically
   correctly but pathologically slowly.

**Bank detection and fallback (AC-005-01, AC-005-02, AC-005-03)**

`parsePDF` tries the bank-specific parser first (N26/DKB); if that yields zero transactions —
either because `detectBank` returned "Sonstige"/"ING" (no dedicated parser exists for ING despite
being in the detection table) or because the bank-specific parser found nothing — it falls back to
`parseGeneric`. This means "ING" is *detected* but has no ING-specific parser; ING statements are
always parsed generically. REQ-005's bank table doesn't call this out explicitly.

**Category suggestion (integration with ARCH-006)**

After parsing, `pdfRouter` maps each transaction through
`storage.suggestCategory(tx.description)` before returning the preview — the suggestion itself is
computed once per upload, not learned or re-computed client-side.

**Deduplication (REQ-005 Notes)**

`parsePDF`'s final step dedupes *within a single upload* using the composite key
`date|description|amount`. Cross-import duplicate detection (the same statement uploaded twice)
is explicitly not implemented — reflected in REQ-005 Notes, not a gap.

## Key Decisions

- **Memory storage for uploads (`multer.memoryStorage()`), not disk** — statements are parsed
  once, in-request, and never need to be re-read; avoids managing temp-file cleanup or leaving
  financial documents on disk even transiently.
- **10s hard timeout via `Promise.race`, not a streaming/cancellable parse** — `pdf-parse` (or
  equivalent) has no native cancellation; racing against a timeout is the simplest way to bound
  worst-case request latency for a pathological PDF.
- **Bank-specific parsers attempted before generic, not the other way round** — bank-specific
  parsers understand each bank's exact column layout and produce more accurate `date`/`amount`
  extraction; generic parsing is a lower-precision fallback, so precedence matters.

## Out of Scope

- Category suggestion algorithm and learning — [ARCH-006](ARCH-006.md).
- Saving the reviewed transactions (`POST /api/transactions/batch`) — [ARCH-011](ARCH-011.md).
- Paperless-ngx as an alternative PDF source — REQ-016, not part of this session.

## Open Questions

- **No API-level test exists for `POST /api/import/pdf` at all.** `tests/server/unit/pdfParser.test.ts`
  covers only the pure helpers (`parseGermanAmount`, `parseGermanDate`, `detectBank`) — none of
  `parseN26`, `parseDKB`, `parseGeneric`, or the route itself (upload validation, magic-byte
  rejection, rate limiting, timeout, category-suggestion wiring) have any test coverage. See the
  Test Gap Backlog — this is the largest gap found in this migration so far.
- `docs/architecture/ARC42.md` §3.1/§5.4's bank table and REQ-005's own table both list "ING" as a
  detected bank, but `pdfParser.ts` has no `parseING` — ING statements silently fall through to
  `parseGeneric`. Not a functional bug (AC-005-03's generic fallback is exactly this case), but
  worth a documentation fix so a reader doesn't assume ING gets bank-specific parsing.
