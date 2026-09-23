# TEST-010 — Month Filtering & Navigation

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-010
**Verifies:** REQ-010 (AC-010-01 … AC-010-07)

## Test Cases

### TC-010-01 — Current month is selected by default

**Maps to:** AC-010-01
**Type:** e2e
**File:** ❌ missing

**Notes:** No test asserts the month selector's *default value* is the current month (only that
the selector is visible — `dashboard.spec.ts`). See Test Gap Backlog.

---

### TC-010-02 — Month selector shows all months with data

**Maps to:** AC-010-02
**Type:** integration
**File:** `tests/server/api/transactions.test.ts`

**Notes:** Covered at the API level by `GET /api/months` → `includes a month after a transaction
is created for it` — proves a created month appears in the list. Does not assert descending order
across multiple months, or the merged/deduplicated result the UI ultimately renders. See Test Gap
Backlog for the ordering and UI-merge parts (**low** — `storage.getAvailableMonths()`'s `SELECT
DISTINCT ... ORDER BY ... DESC` is simple, low-risk SQL).

---

### TC-010-03 — Current month is always in the selector even without data

**Maps to:** AC-010-03
**Type:** e2e
**File:** ❌ missing

**Notes:** The client-side merge-with-current-month logic (ARCH-010) has no test on either page.
See Test Gap Backlog.

---

### TC-010-04 — Selecting a different month updates the Dashboard

**Maps to:** AC-010-04
**Type:** e2e
**File:** ❌ missing

**Notes:** Overlaps TEST-007's TC-007-02 (KPIs update on month change) and TEST-009's TC-009-07
(Sankey updates on month change) — same underlying gap, counted once here and cross-referenced
rather than tripled in the backlog.

---

### TC-010-05 — Selecting a different month updates the Transactions page

**Maps to:** AC-010-05
**Type:** e2e
**File:** ❌ missing

**Notes:** No E2E spec exists for the Transactions page at all (same gap noted in TEST-004's
TC-004-01). See Test Gap Backlog.

---

### TC-010-06 — Month format is validated on the API

**Maps to:** AC-010-06
**Type:** integration
**File:** ❌ missing (transaction-list path is covered elsewhere)

**Notes:** The AC's own example (`GET /api/summary/2026-4`) targets the **summary** endpoint.
🔴 **Confirmed by direct test, not inferred: `GET /api/summary/:month` has no month-format
validation at all** — `GET /api/summary/2026-4` returns `200` with an empty/zeroed summary, not
`400`. See `docs/architecture/ARCH-010.md` Open Questions. **Medium risk**, logged in the Test Gap
Backlog as a confirmed implementation gap. (The *transaction-list* query-param path,
`GET /api/transactions?month=`, does validate correctly and is already covered by TEST-004's
`rejects invalid month format on GET` — that test satisfies a *related* but not *this* AC, since
the AC's own Gherkin names the summary endpoint specifically.)

---

### TC-010-07 — Month names are displayed in German locale

**Maps to:** AC-010-07
**Type:** e2e
**File:** ❌ missing

**Notes:** No test asserts the rendered month text is German ("April 2026") rather than English.
`toLocaleDateString("de-DE", ...)` is used identically in both `Dashboard.tsx` and
`Transactions.tsx` (verified by direct code inspection, ARCH-010), so a regression would likely
affect both pages identically — one E2E assertion on either page would cover the shared risk. See
Test Gap Backlog (**low**).
