# TEST-002 — Account Management

**Status:** approved
**Created:** 2026-09-23
**Traces:** ARCH-002
**Verifies:** REQ-002 (AC-002-01, AC-002-02, AC-002-03, AC-002-04, AC-002-05, AC-002-06, AC-002-07)

## Test Cases

### TC-002-01 — Create a new account

**Maps to:** AC-002-01
**Type:** integration
**File:** `tests/server/api/accounts.test.ts`

```gherkin
Given the user is on the Accounts page
When the user clicks "Neues Konto"
And fills in name "Girokonto", bank "ING", type "checking", color "#01696f"
And submits the form
Then the new account appears in the account list
And a success toast is shown
```

**Notes:** Covered by `POST /api/accounts` → `creates an account and returns 201`. Toast is a
client-side concern, out of scope for an API test.

---

### TC-002-02 — Create account with IBAN validation

**Maps to:** AC-002-02
**Type:** integration
**File:** `tests/server/api/accounts.test.ts`

```gherkin
Given the user is on the Accounts page
When the user fills in an invalid IBAN "DE00"
And submits the form
Then the form shows a validation error on the IBAN field
And no account is created
```

**Notes:** Closed in Session 10 — `POST /api/accounts` → `rejects an invalid IBAN` (asserts `400`
for `"not-an-iban"`).

---

### TC-002-03 — Edit an existing account

**Maps to:** AC-002-03
**Type:** integration
**File:** `tests/server/api/accounts.test.ts`

```gherkin
Given an account "Girokonto" exists
When the user clicks the edit icon on that account
And changes the name to "Gehaltskonto"
And saves
Then the account name is updated to "Gehaltskonto"
And a success toast is shown
```

**Notes:** Covered by `PUT /api/accounts/:id` → `updates account name`.

---

### TC-002-04 — Edit an account without IBAN

**Maps to:** AC-002-04
**Type:** integration
**File:** `tests/server/api/accounts.test.ts`

**Notes:** Closed in Session 10 — `PUT /api/accounts/:id` → `clears an existing IBAN when updated
with iban: null` confirms `ibanSchema` is nullable on the update path too.

---

### TC-002-05 — Delete an account

**Maps to:** AC-002-05
**Type:** integration
**File:** `tests/server/api/accounts.test.ts`

```gherkin
Given an account "Testkonto" exists with no transactions
When the user clicks the delete icon and confirms
Then the account is removed from the list
```

**Notes:** Covered by `DELETE /api/accounts/:id` → `deletes the account`.

---

### TC-002-06 — Invalid color is rejected

**Maps to:** AC-002-06
**Type:** integration
**File:** `tests/server/api/accounts.test.ts`

```gherkin
When the user submits an account with color "notacolor"
Then the API returns status 400
And the error indicates the color field is invalid
```

**Notes:** Covered by `POST /api/accounts` → `rejects an invalid color` (uses `"red"`, not
literally `"notacolor"` — same failure mode, not worth a Test Gap entry).

---

### TC-002-07 — Account list is displayed on the Accounts page

**Maps to:** AC-002-07
**Type:** integration
**File:** `tests/server/api/accounts.test.ts` (list endpoint) + `tests/e2e/accounts.spec.ts` (UI)

```gherkin
Given three accounts exist
When the user navigates to the Accounts page
Then all three accounts are visible with their name, bank badge, and color dot
```

**Notes:** `GET /api/accounts` → `returns an empty array on a fresh DB` proves the list endpoint
shape. `tests/e2e/accounts.spec.ts` → `creates a new account` asserts the account name becomes
visible on the page after creation, which partially covers "accounts are visible" — it does not
assert the bank badge or color dot are rendered. E2E specs are not part of CI yet
(`testing-practices.md`), so this AC is only partially verified end-to-end.
