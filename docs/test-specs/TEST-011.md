# TEST-011 — Batch Transaction Import

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-011
**Verifies:** REQ-011 (AC-011-01 … AC-011-06)

## Test Cases

### TC-011-01 — All valid transactions are saved in one request

**Maps to:** AC-011-01
**Type:** integration
**File:** `tests/server/api/transactions.test.ts`

```gherkin
Given a PDF import preview with 30 transactions
When the user clicks "Importieren"
Then a single POST /api/transactions/batch request is made
And the response contains 30 created transactions
And the user sees a success message
```

**Notes:** Covered by `POST /api/transactions/batch` → `saves all valid transactions and returns
201 with created array` (5 items, not 30 — the exact count doesn't matter for this AC, the
behavior is the same). Already carries a `// TC-011-01` reference candidate — see comment updates
below. "User sees a success message" is a client-side concern.

---

### TC-011-02 — Invalid items in the batch are skipped, valid ones are saved

**Maps to:** AC-011-02
**Type:** integration
**File:** `tests/server/api/transactions.test.ts`

```gherkin
Given a batch of 10 transactions where 1 has an invalid account ID
When the batch request is sent
Then 9 transactions are created
And the response includes a "skipped" count of 1
And the "errors" array describes which item failed and why
```

**Notes:** Covered by `POST /api/transactions/batch` → `partially succeeds — valid items saved,
invalid type skipped` — uses an invalid `type` rather than an invalid `accountId`, but exercises
the identical partial-success code path (`insertTransactionSchema.safeParse` per item). Not worth
a separate Test Gap entry; same validation branch either way.

---

### TC-011-03 — Batch size is limited to 500 transactions

**Maps to:** AC-011-03
**Type:** integration
**File:** `tests/server/api/transactions.test.ts`

```gherkin
When the client sends a batch with 501 transactions
Then the API returns status 400
And the error indicates the batch exceeds the maximum size
```

**Notes:** Covered by `POST /api/transactions/batch` → `rejects a batch exceeding 500 items`.

---

### TC-011-04 — Batch endpoint is rate-limited

**Maps to:** AC-011-04
**Type:** integration
**File:** ❌ missing

**Notes:** `batchRateLimiter` has no `NODE_ENV=test` skip, so this is testable (20 sequential batch
requests, then assert `429` on the 21st) but not written. See Test Gap Backlog (**medium**).

---

### TC-011-05 — Category learning is triggered after successful import

**Maps to:** AC-011-05
**Type:** e2e
**File:** ❌ missing

**Notes:** Cross-endpoint orchestration (client calls `/batch` then `/learn`); the individual
`/learn` behavior is TEST-006's concern, this AC is specifically about the two-request workflow
happening together after a successful save. No E2E coverage of the Import page exists at all
(same gap noted in TEST-005 TC-005-08). See Test Gap Backlog (**medium**).

---

### TC-011-06 — Learn batch validates entry structure

**Maps to:** AC-011-06
**Type:** integration
**File:** ❌ missing

**Notes:** Same finding as TC-006-08 — 🔴 confirmed by direct test that this AC does not hold: an
over-length or otherwise invalid entry currently fails the *entire* `/learn` batch with `400`
rather than being skipped while valid entries are processed. See
`docs/architecture/ARCH-011.md` Open Questions. **High risk**, implementation gap.
