# TEST-007 — Dashboard & Financial Overview

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-007
**Verifies:** REQ-007 (AC-007-01 … AC-007-08)

All ACs are E2E/UI-rendering concerns (client-only feature, ARCH-007); the underlying data
(`GET /api/summary/:month`) is already covered by TEST-004.

## Test Cases

### TC-007-01 — Dashboard shows KPIs for the current month by default

**Maps to:** AC-007-01
**Type:** e2e
**File:** ❌ missing

**Notes:** `tests/e2e/dashboard.spec.ts` → `Dashboard loads and shows the month selector` only
asserts the selector is visible, not that it defaults to the *current* month. See Test Gap
Backlog.

---

### TC-007-02 — KPIs update when a different month is selected

**Maps to:** AC-007-02
**Type:** e2e
**File:** ❌ missing

**Notes:** No test changes the month selector and asserts KPI values change accordingly. See Test
Gap Backlog.

---

### TC-007-03 — Savings rate is calculated correctly

**Maps to:** AC-007-03
**Type:** e2e
**File:** `tests/server/api/summary.test.ts`

**Notes:** Session 10 closed the underlying data-correctness gap at the API level (the formula
itself lives server-side in `summary.ts`, the Dashboard just renders it) —
`GET /api/summary/:month — Bilanz-Berechnung` → `berechnet totalIncome und totalExpenses korrekt
für bekannte Eingabedaten` seeds two income and two expense transactions with known amounts and
asserts the exact `totalIncome`/`totalExpenses` the Bilanz/Sparquote card is computed from. The
E2E-level assertion of the exact rendered card text (including the Sparquote percentage formula
applied client-side) is still not covered.

**Status: partially accepted (Session 10).** Server-side formula correctness — the actual
high-risk part — is now covered; the remaining gap is a thin, low-risk client-side rendering
concern. Left as a follow-up.

---

### TC-007-04 — Negative balance is shown in red

**Maps to:** AC-007-04
**Type:** e2e
**File:** ❌ missing

**Notes:** No test creates expense > income for a month and asserts the Bilanz card's color class.
See Test Gap Backlog.

---

### TC-007-05 — Dashboard shows per-account breakdown

**Maps to:** AC-007-05
**Type:** e2e
**File:** ❌ missing

**Notes:** `Account KPI card appears after seeding data` (dashboard.spec.ts) asserts one account's
card is visible with its name — does not assert income/expenses/balance are shown per card, and
only tests a single-account scenario, not "three accounts → three cards." See Test Gap Backlog.

---

### TC-007-06 — Empty month shows zero KPIs

**Maps to:** AC-007-06
**Type:** e2e
**File:** ❌ missing

**Notes:** No test selects a month with no transactions and asserts `0,00 €`/`0.0%` on every KPI
card plus an empty Sankey chart. See Test Gap Backlog.

---

### TC-007-07 — No accounts shows a guidance message

**Maps to:** AC-007-07
**Type:** e2e
**File:** ❌ missing

**Notes:** No test exercises the zero-accounts state (all existing dashboard tests seed at least
one account via `seedData()`). See Test Gap Backlog.

---

### TC-007-08 — Loading state shows skeleton placeholders

**Maps to:** AC-007-08
**Type:** e2e
**File:** ❌ missing

**Notes:** No test asserts skeleton elements are present before data resolves (would need to
intercept/delay the `/api/summary/:month` response). See Test Gap Backlog (**low** — cosmetic,
hardest of this REQ's gaps to test reliably).
