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
`transactions.spec.ts`). See Test Gap Backlog.

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
**File:** ❌ missing

**Notes:** `GET /api/transactions` supports an `accountId` query parameter
(`server/routes/transactions.ts`), but no test creates transactions on two different accounts and
asserts the `accountId` filter narrows the result. See Test Gap Backlog.

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
**File:** ❌ missing

**Notes:** No test creates a `type: "transfer"` transaction via `POST /api/transactions` and
asserts the response includes `transferToAccountId`. The *effect* of a transfer (balance
accounting) is separately covered by TC-004-11/12 via the summary endpoint, but the create-path
itself for a transfer row has no direct test. See Test Gap Backlog.

---

### TC-004-06 — Transfer requires a target account

**Maps to:** AC-004-06
**Type:** integration
**File:** ❌ missing

**Notes:** This AC is enforced client-side only (see ARCH-004 Open Questions) — the server accepts
a `transfer` transaction with no `transferToAccountId`. No test exists for either the intended
client-side validation (no E2E spec for the Transactions page, see TC-004-01) or the server's
actual accepting behavior. **High risk**: flagged in the Test Gap Backlog together with the
underlying implementation gap in ARCH-004.

---

### TC-004-07 — Edit a transaction's category

**Maps to:** AC-004-07
**Type:** integration
**File:** ❌ missing

**Notes:** `PATCH /api/transactions/:id` exists specifically for this use case (ARCH-004), but no
test in `tests/server/api/transactions.test.ts` calls it — the file only exercises `POST`,
`GET`, `POST /batch`, and `GET /api/months`. See Test Gap Backlog.

---

### TC-004-08 — Delete a transaction

**Maps to:** AC-004-08
**Type:** integration
**File:** ❌ missing

**Notes:** `DELETE /api/transactions/:id` exists but is never called by any test. See Test Gap
Backlog.

---

### TC-004-09 — Amount must be positive

**Maps to:** AC-004-09
**Type:** integration
**File:** ❌ missing

**Notes:** No test submits a transaction with a negative `amount` and asserts `400`.
`insertTransactionSchema` extends the base Drizzle column (`amount: real("amount").notNull()`,
`shared/schema.ts:66`) only with `type`; there is no `.positive()`/`.min(0)` refinement on
`amount` anywhere in the schema. **Confirmed empirically (not just inferred from the schema) that this AC is currently violated**:
`POST /api/transactions` with `amount: -50` returns `201`, not `400` — contradicting both this AC
and the `amount` domain invariant in `architecture.md`. Also note `shared/schema.ts:66`'s
own column comment ("positive = income, negative = expense") describes the *old*, pre-invariant
convention and is itself stale against `architecture.md`'s "amount always positive, type carries
sign" rule. See Test Gap Backlog (**high**).

---

### TC-004-10 — Month format is validated

**Maps to:** AC-004-10
**Type:** integration
**File:** ❌ missing

**Notes:** `GET /api/transactions?month=` is covered (`rejects invalid month format on GET`), but
no test posts a transaction with an invalid `month` in the request **body** and asserts `400`.
Given `month` is a plain string column with no dedicated pattern refinement visible on
`insertTransactionSchema` (unlike the query-param path, which has its own `monthSchema`), this is
worth writing to actually confirm the AC holds on create. See Test Gap Backlog (**medium**).

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
