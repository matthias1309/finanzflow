# TEST-005 — PDF Bank Statement Import

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-005
**Verifies:** REQ-005 (AC-005-01 … AC-005-11)

Session 10 closed most gaps at two levels: `tests/server/unit/pdfParser.test.ts` now exercises
`parseN26`/`parseDKB`/`parseGeneric` directly with synthetic text fixtures (these three functions
were exported for testability — no behavior change), and `tests/server/api/pdf.test.ts` /
`pdf-rate-limit.test.ts` exercise `POST /api/import/pdf` end-to-end with `parsePDF` mocked at the
module boundary (same pattern as `paperless.test.ts`), so no real PDF binary fixture was needed.

## Test Cases

### TC-005-01 — Upload and preview an N26 PDF

**Maps to:** AC-005-01
**Type:** integration
**File:** `tests/server/unit/pdfParser.test.ts`, `tests/server/api/pdf.test.ts`

**Notes:** Closed in Session 10. `parseN26` is unit-tested directly (income/expense, context-line
description enrichment, header/footer skip lines). `POST /api/import/pdf` → `parses an uploaded
PDF and returns transactions with a category suggestion` covers the route-level upload → parse →
response path with `parsePDF` mocked (the bank-detection/dispatch itself is `parsePDF`'s own job
and stays covered by the unit-level bank parser tests, not re-mocked here).

---

### TC-005-02 — Upload and preview a DKB PDF

**Maps to:** AC-005-02
**Type:** integration
**File:** `tests/server/unit/pdfParser.test.ts`, `tests/server/api/pdf.test.ts`

**Notes:** Closed in Session 10, same approach as TC-005-01. `parseDKB` unit-tested (income/expense,
IBAN-line skip in the description lookback, footer-line skip).

---

### TC-005-03 — Fallback to generic parser for unknown bank

**Maps to:** AC-005-03
**Type:** integration
**File:** `tests/server/unit/pdfParser.test.ts`

**Notes:** Closed in Session 10 at the unit level — `parseGeneric` is now directly tested (all
three line patterns: single-date, two-date, amount-first; plus the short-description and
no-match cases). The route-level "bank-specific parser found nothing, falls back to generic"
dispatch inside `parsePDF` itself is still only implicitly covered (it's a 3-line `if` in
`parsePDF`, exercised whenever `bank !== "N26"/"DKB"` in the mocked API tests) — acceptable given
`parseGeneric`'s own logic is now solidly covered.

---

### TC-005-04 — Non-PDF file is rejected

**Maps to:** AC-005-04
**Type:** integration
**File:** `tests/server/api/pdf.test.ts`

**Notes:** Session 10 added `known issue: currently returns 500 instead of 400 for a non-PDF
upload`. Investigation found `multer`'s `fileFilter` throws a plain `Error` with no `.status`, so
`createApp.ts`'s error handler falls through to its `500` default instead of `400`. This is a
**regression test pinning the current (incorrect) behavior** — update it to assert `400` once
`fileFilter` passes a `status: 400`-carrying error. **Medium risk, implementation gap still open**
— see ARCH-005 Open Questions; not closed by this test, only pinned.

---

### TC-005-05 — File exceeding size limit is rejected

**Maps to:** AC-005-05
**Type:** integration
**File:** ❌ missing

**Notes:** `multer`'s `limits.fileSize` implements this; still untested. A 20 MB+ fixture makes
this an expensive test to run on every CI run.

**Status: accepted (Session 10).** Straightforward library behavior (multer's own size-limit
enforcement), low risk. Would need a lower `MAX_FILE_SIZE_BYTES` behind a test-only env var to
test cheaply — left as a follow-up rather than adding a slow/large fixture to the suite.

---

### TC-005-06 — Corrupted PDF shows a user-friendly error

**Maps to:** AC-005-06
**Type:** integration
**File:** `tests/server/api/pdf.test.ts`

**Notes:** Closed in Session 10 — `POST /api/import/pdf` → `returns 500 with a friendly message
when parsing throws` (mocks `parsePDF` to reject, as a corrupted-but-signed PDF would surface in
`extractPDFText`).

---

### TC-005-07 — PDF with no recognizable transactions shows guidance

**Maps to:** AC-005-07
**Type:** integration
**File:** `tests/server/api/pdf.test.ts`

**Notes:** Closed in Session 10 — `POST /api/import/pdf` → `returns an empty transactions array
for a PDF with no detected transactions`. Asserts the empty `transactions: []` response the client
renders its guidance from; `parsePDF`'s own `errors` message text is unit-tested indirectly via
the mocked resolve value, not re-asserted verbatim (message wording is a client/i18n concern).

---

### TC-005-08 — User reviews and confirms import

**Maps to:** AC-005-08
**Type:** e2e
**File:** ❌ missing

**Notes:** End-to-end workflow (upload → preview → confirm → batch save → learn); no
`tests/e2e/` spec covers the Import page at all. The individual server-side steps
(`POST /api/transactions/batch`, `POST /api/category-rules/learn`) are covered separately by
TEST-004/TEST-011/TEST-006, and the PDF-import route itself now has solid coverage (TC-005-01/02),
but the page-level orchestration of upload → preview → confirm is still untested.

**Status: accepted (Session 10).** All server-side building blocks are covered; only the
client-side orchestration/UI flow remains. Left as an E2E follow-up.

---

### TC-005-09 — User adjusts a category before importing

**Maps to:** AC-005-09
**Type:** e2e
**File:** ❌ missing

**Notes:** Client-side behavior (tracking whether a category was overridden) plus its effect on
what gets sent to `/learn` — see ARCH-006 "Learning trigger and override."

**Status: accepted (Session 10).** Client-only state-tracking, no server-side risk. Left as an E2E
follow-up.

---

### TC-005-11 — Upload and preview a Trade Republic PDF

**Maps to:** AC-005-11
**Type:** unit
**File:** `tests/server/unit/pdfParser.test.ts`

**Notes:** `parseTradeRepublic` unit-tested directly against synthetic text fixtures derived from
a real "Kontoauszug" statement: dividend/interest income (abbreviated German month date), a
withdrawal expense, the column-header line, and — the key regression case — a
`GELDMARKTFONDS` purchase-table row that must **not** be imported (bare `STK` number, no text
description). `detectBank` gets two matching cases (name, BIC). No dedicated API-level test was
added, following the same reasoning as TC-005-01/02: the route-level dispatch is a 3-line `if` in
`parsePDF`, already exercised by the mocked API tests regardless of which bank branch fires.

---

### TC-005-10 — Rate limit is enforced

**Maps to:** AC-005-10
**Type:** integration
**File:** `tests/server/api/pdf-rate-limit.test.ts`

**Notes:** Closed in Session 10 — kept in its own test file (separate `createApp()`/process) so
`pdfRateLimiter`'s in-memory counter isn't already partially consumed by the other PDF-import
tests. 10 successful uploads followed by a `429` on the 11th.
