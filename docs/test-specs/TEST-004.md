# TEST-004 — Transaction Management

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-004
**Verifies:** REQ-004 (AC-004-01, AC-004-02, AC-004-03, AC-004-04, AC-004-05, AC-004-06, AC-004-07, AC-004-08, AC-004-09, AC-004-10, AC-004-11, AC-004-12)

## Test Cases

### TC-004-01 — View transactions for the current month

**Maps to:** AC-004-01
**Type:** e2e
**File:** ❌ missing

**Notes:** "Each row shows description, amount, category, and date" is a UI-rendering assertion;
no Playwright spec for the Transactions page exists (`tests/e2e/` has `accounts.spec.ts`,
`categories.spec.ts`, `dashboard.spec.ts`, `login.spec.ts`, `users.spec.ts` — no
`transactions.spec.ts`).

**Status: accepted (Session 10).** The underlying data (what a row would render) is well-covered
server-side by TEST-004's other TCs; only the rendering itself is untested. Left as an E2E
follow-up.

---

### TC-004-02 — Filter transactions by month

**Maps to:** AC-004-02
**Type:** integration
**File:** `tests/server/api/transactions.test.ts`

```gherkin
Given transactions exist for "2026-03" and "2026-04"
When the user selects "März 2026" in the month filter
Then only March transactions are shown
```

**Notes:** Covered by `GET /api/transactions` → `filters by month`.

---

### TC-004-03 — Filter transactions by account

**Maps to:** AC-004-03
**Type:** integration
**File:** `tests/server/api/transactions.test.ts`

**Notes:** Closed in Session 10 — `GET /api/transactions` → `filters by accountId`.

---

### TC-004-04 — Create a manual income transaction

**Maps to:** AC-004-04
**Type:** integration
**File:** `tests/server/api/transactions.test.ts`

```gherkin
Given at least one account and one income category exist
When the user clicks "Neue Buchung"
And enters description "Freelance Projekt", amount 500, type "income"
And selects account "Girokonto" and category "Nebeneinkommen"
And submits
Then the transaction appears in the list for the current month
And the amount is shown as "+500,00 €"
```

**Notes:** Covered by `POST /api/transactions` → `creates a transaction and returns 201`. The
"+500,00 €" formatting is a client-side concern.

---

### TC-004-05 — Create a transfer between accounts

**Maps to:** AC-004-05
**Type:** integration
**File:** `tests/server/api/transactions.test.ts`

**Notes:** Closed in Session 10 — `POST /api/transactions` → `creates a transfer transaction and
returns 201` (asserts `type` and `transferToAccountId` in the response).

---

### TC-004-06 — Transfer requires a target account

**Maps to:** AC-004-06
**Type:** integration
**File:** `tests/server/api/transactions.test.ts`

**Notes:** This AC is enforced client-side only (see ARCH-004 Open Questions) — the server accepts
a `transfer` transaction with no `transferToAccountId`. Session 10 added a **regression test**
(`known issue: currently accepts a transfer with no transferToAccountId (AC-004-06)`) that
documents the current, incorrect `201` response — it is written to fail once the implementation
gap is fixed, at which point it should be updated to assert `400`. The intended client-side
validation itself still has no E2E coverage (see TC-004-01). **High risk, implementation gap still
open** — see ARCH-004 Open Questions; not closed by this test, only pinned.

---

### TC-004-07 — Edit a transaction's category

**Maps to:** AC-004-07
**Type:** integration
**File:** `tests/server/api/transactions.test.ts`

**Notes:** Closed in Session 10 — `PATCH /api/transactions/:id` → `updates the category of a
transaction`, plus 404/400 edge cases.

---

### TC-004-08 — Delete a transaction

**Maps to:** AC-004-08
**Type:** integration
**File:** `tests/server/api/transactions.test.ts`

**Notes:** Closed in Session 10 — `DELETE /api/transactions/:id` → `deletes a transaction`.

---

### TC-004-09 — Amount must be positive

**Maps to:** AC-004-09
**Type:** integration
**File:** `tests/server/api/transactions.test.ts`

**Notes:** `insertTransactionSchema` extends the base Drizzle column (`amount: real("amount").notNull()`,
`shared/schema.ts:66`) only with `type`; there is no `.positive()`/`.min(0)` refinement on
`amount` anywhere in the schema. Session 10 added a **regression test**
(`known issue: currently accepts a negative amount instead of rejecting it (AC-004-09)`) that
pins the current, incorrect `201` response for `amount: -50` — update it to assert `400` once the
schema gets a `.positive()` refinement. Also note `shared/schema.ts:66`'s own column comment
("positive = income, negative = expense") describes the *old*, pre-invariant convention and is
itself stale against `architecture.md`'s "amount always positive, type carries sign" rule.
**High risk, implementation gap still open** — see ARCH-004 Open Questions; not closed by this
test, only pinned.

---

### TC-004-10 — Month format is validated

**Maps to:** AC-004-10
**Type:** integration
**File:** `tests/server/api/transactions.test.ts`

**Notes:** `GET /api/transactions?month=` is covered (`rejects invalid month format on GET`).
Session 10 investigated the create path and confirmed `insertTransactionSchema` has no month
pattern refinement at all (unlike the query-param path's dedicated `monthSchema`) — a **regression
test** (`known issue: currently accepts an invalid month format on create (AC-004-10)`) pins the
current, incorrect `201` response; update it to assert `400` once the schema gets the same guard.
**Medium risk, implementation gap still open** — see ARCH-004 Open Questions; not closed by this
test, only pinned.

---

### TC-004-11 — An inter-account transfer increases the target account's balance

**Maps to:** AC-004-11
**Type:** integration
**File:** `tests/server/api/summary.test.ts`

```gherkin
Given accounts "Girokonto" and "Gemeinschaftskonto" exist
And a transfer transaction of 200 € from "Girokonto" to "Gemeinschaftskonto" was created for "2026-04"
When GET /api/summary/2026-04 is called
Then accountSummaries[Gemeinschaftskonto].transfersIn contains the value 200
And the displayed balance of "Gemeinschaftskonto" is 200 €
And the displayed balance of "Girokonto" is 0 € (a transfer is not an expense item)
```

**Notes:** Covered by `GET /api/summary/:month — Überträge` → `enthält transfersIn für das
Zielkonto` (target's `transfersIn === 200`) and `Quellkonto hat transfersIn = 0` (source
unaffected). Does not separately assert `totalExpenses` on the source account is `0`, but
ARCH-004's `buildAccountSummaries` design makes that a `continue`-before-the-expense-branch
guarantee, not something the transfer path could accidentally hit.

---

### TC-004-12 — Multiple incoming transfers are summed

**Maps to:** AC-004-12
**Type:** integration
**File:** `tests/server/api/summary.test.ts`

```gherkin
Given "Girokonto" transfers 100 € and 150 € in two separate transfers to "Gemeinschaftskonto"
When GET /api/summary/2026-04 is called
Then accountSummaries[Gemeinschaftskonto].transfersIn contains the value 250
```

**Notes:** Covered by `GET /api/summary/:month — Überträge` → `addiert mehrere eingehende
Überträge`.
