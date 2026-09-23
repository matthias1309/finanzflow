# TEST-005 — PDF Bank Statement Import

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-005
**Verifies:** REQ-005 (AC-005-01 … AC-005-10)

`tests/server/unit/pdfParser.test.ts` only covers the pure helpers (`parseGermanAmount`,
`parseGermanDate`, `detectBank`). **No test exercises `POST /api/import/pdf`, `parseN26`,
`parseDKB`, or `parseGeneric` at all** — every AC below is `❌ missing` except where a helper
function happens to overlap.

## Test Cases

### TC-005-01 — Upload and preview an N26 PDF

**Maps to:** AC-005-01
**Type:** integration
**File:** ❌ missing

**Notes:** Would need a synthetic N26 PDF fixture (`testing-practices.md`/`git-workflow.md`: real
bank statements never committed) or a mocked `extractPDFText`. `detectBank` itself is unit-tested;
the full upload → parse → preview path is not. See Test Gap Backlog (**high** — core feature, zero
coverage).

---

### TC-005-02 — Upload and preview a DKB PDF

**Maps to:** AC-005-02
**Type:** integration
**File:** ❌ missing

**Notes:** Same gap as TC-005-01, DKB variant. `parseDKB` has no unit test either. See Test Gap
Backlog (**high**).

---

### TC-005-03 — Fallback to generic parser for unknown bank

**Maps to:** AC-005-03
**Type:** integration
**File:** ❌ missing

**Notes:** `detectBank` → `"Sonstige"` for unrecognized text is unit-tested
(`returns Sonstige for unknown content`); `parseGeneric` itself, and the route-level fallback
behavior when a bank-specific parser finds zero transactions, are not. See Test Gap Backlog
(**medium**).

---

### TC-005-04 — Non-PDF file is rejected

**Maps to:** AC-005-04
**Type:** integration
**File:** ❌ missing

**Notes:** `multer`'s `fileFilter` implements this, but no test uploads a non-PDF MIME type and
asserts `400`. See Test Gap Backlog (**medium** — a boundary/security-relevant check).

---

### TC-005-05 — File exceeding size limit is rejected

**Maps to:** AC-005-05
**Type:** integration
**File:** ❌ missing

**Notes:** `multer`'s `limits.fileSize` implements this; untested. A 20 MB+ fixture would make this
an expensive test to run repeatedly — worth considering a smaller injected limit for the test
environment when this gap is closed. See Test Gap Backlog (**low** — straightforward library
behavior, lower risk than the parsing gaps).

---

### TC-005-06 — Corrupted PDF shows a user-friendly error

**Maps to:** AC-005-06
**Type:** integration
**File:** ❌ missing

**Notes:** No test uploads a file starting with `%PDF-` but containing garbage afterward. See Test
Gap Backlog (**medium**).

---

### TC-005-07 — PDF with no recognizable transactions shows guidance

**Maps to:** AC-005-07
**Type:** integration
**File:** ❌ missing

**Notes:** `parsePDF`'s "Keine Buchungen automatisch erkannt..." message exists in code but is
never asserted by a test. See Test Gap Backlog (**low**).

---

### TC-005-08 — User reviews and confirms import

**Maps to:** AC-005-08
**Type:** e2e
**File:** ❌ missing

**Notes:** End-to-end workflow (upload → preview → confirm → batch save → learn); no
`tests/e2e/` spec covers the Import page at all. The individual server-side steps
(`POST /api/transactions/batch`, `POST /api/category-rules/learn`) are covered separately by
TEST-004/TEST-011/TEST-006, but the PDF-import-specific orchestration of the two is not. See Test
Gap Backlog (**medium**).

---

### TC-005-09 — User adjusts a category before importing

**Maps to:** AC-005-09
**Type:** e2e
**File:** ❌ missing

**Notes:** Client-side behavior (tracking whether a category was overridden) plus its effect on
what gets sent to `/learn` — see ARCH-006 "Learning trigger and override." No test. See Test Gap
Backlog (**medium**).

---

### TC-005-10 — Rate limit is enforced

**Maps to:** AC-005-10
**Type:** integration
**File:** ❌ missing

**Notes:** `pdfRateLimiter` has **no `NODE_ENV=test` skip** (unlike `authRateLimiter`), so this AC
is actually testable in the current test setup — 11 sequential uploads to the same `agent` should
trigger a `429` on the 11th. Not written. See Test Gap Backlog (**medium** — testable, just
missing).
