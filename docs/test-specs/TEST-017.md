# TEST-017 — Transfer Detection in the Import Preview

**Status:** draft
**Created:** 2026-09-25
**Traces:** ARCH-017
**Verifies:** REQ-017 (AC-017-01 … AC-017-17)

Detection logic is verified at the API level against `POST /api/transfers/detect` with the
in-memory DB. The unit tests only cover the parser changes. E2E covers only what the client does
itself: applying suggestions, overrides, and the delete after the save. Nothing is tested twice
across layers (`testing-practices.md`). E2E tests intercept the parse endpoint with a synthetic
`ParseResult` (`page.route`), so no PDF fixture and no real IBAN is needed. All IBANs are public
example IBANs.

TC-017-18 … 22 verify design rules from ARCH-017 and the REQ-017 Notes that no AC covers.

## Test Cases

### TC-017-01 — Outgoing transfer detected by counterparty IBAN

**Maps to:** AC-017-01
**Type:** integration
**File:** `tests/server/api/transfers.test.ts`

```gherkin
Given own accounts "N26" and "DKB Giro" exist and "DKB Giro" has the IBAN "DE02120300000000202051"
And a statement for "N26" contains a debit of 500,00 € whose counterparty IBAN is "DE02120300000000202051"
When the user uploads the statement and selects "N26" as the account in the preview
Then the preview row shows "Umbuchung"
And its target account is "DKB Giro"
```

**Notes:** Two accounts via `POST /api/accounts` (target with IBAN). `POST /api/transfers/detect` with one expense row on "N26" carrying the target IBAN → `{ kind: "transfer", targetAccountId: <DKB Giro>, basis: "iban" }`. The preview marker "Umbuchung" itself is rendered by `TransferCell` and asserted in TC-017-11 (E2E), no duplicate UI test here.

---

### TC-017-02 — Imported outgoing transfer is stored as a transfer

**Maps to:** AC-017-02
**Type:** integration
**File:** `tests/server/api/transfers.test.ts`

```gherkin
Given the preview row from AC-017-01 is marked as a transfer to "DKB Giro"
When the user clicks "Importieren"
Then the transaction is stored with type "transfer" and transferToAccountId of "DKB Giro"
And it is not counted in the expenses of "N26" in GET /api/summary/:month
```

**Notes:** `POST /api/transactions/batch` with `type: "transfer"` + `transferToAccountId`, then `GET /api/summary/2026-09`: `totalExpenses` of "N26" unchanged, `transfersOut[<DKB Giro>] = 500`. Builds on the existing REQ-004 behavior (TC-004-11), and here it pins the batch path the import now uses.

---

### TC-017-03 — Incoming transfer by counterparty IBAN is marked as counter-booking

**Maps to:** AC-017-03
**Type:** integration
**File:** `tests/server/api/transfers.test.ts`

```gherkin
Given own accounts "N26" with the IBAN "DE89370400440532013000" and "DKB Giro" exist
And a statement for "DKB Giro" contains a credit of 500,00 € whose counterparty IBAN is "DE89370400440532013000"
When the user uploads the statement and selects "DKB Giro" as the account in the preview
Then the preview row shows "Gegenbuchung von N26"
And the row is excluded from the import by default
```

**Notes:** Expect `{ kind: "counterBooking", sourceAccountId: <N26>, basis: "iban" }`. "Excluded by default" is the client applying `skip = true` → asserted in TC-017-12 (E2E).

---

### TC-017-04 — Foreign counterparty IBAN is not treated as a transfer

**Maps to:** AC-017-04
**Type:** integration
**File:** `tests/server/api/transfers.test.ts`

```gherkin
Given no own account has the IBAN "DE44500105175407324931"
And a statement contains a debit of 80,00 € whose counterparty IBAN is "DE44500105175407324931"
When the user uploads the statement
Then the preview row is an expense
And no target account is set
```

**Notes:** Also seed a stored income of the same amount on another own account within ±3 days: the result must still be `none`, because a foreign IBAN disables the match strategy (ARCH-017 rule 2).

---

### TC-017-05 — Counterparty IBAN of the selected account itself is not a transfer

**Maps to:** AC-017-05
**Type:** integration
**File:** `tests/server/api/transfers.test.ts`

```gherkin
Given the own account "N26" has the IBAN "DE89370400440532013000"
And a statement contains a booking whose counterparty IBAN is "DE89370400440532013000"
When the user selects "N26" as the account in the preview
Then the preview row is not marked as a transfer
```

**Notes:** Covers the statement-owner IBAN from the page header being picked up for the first booking.

---

### TC-017-06 — IBAN comparison ignores spaces and letter case

**Maps to:** AC-017-06
**Type:** integration
**File:** `tests/server/api/transfers.test.ts`

```gherkin
Given the own account "DKB Giro" has the IBAN "DE02120300000000202051"
And a statement lists the counterparty IBAN as "de02 1203 0000 0000 2020 51"
When the user uploads the statement and selects another own account in the preview
Then the preview row is marked as a transfer to "DKB Giro"
```

**Notes:** Request `counterpartyIban: "de02 1203 0000 0000 2020 51"` (max 42 chars accepted). Normalization of the parser output itself is TC-017-20.

---

### TC-017-07 — Incoming credit without IBAN matched against a stored outgoing transfer

**Maps to:** AC-017-07
**Type:** integration
**File:** `tests/server/api/transfers.test.ts`

```gherkin
Given a stored transaction of type "transfer" from "N26" to "DKB Giro" of 500,00 € dated 2026-09-01
And a statement for "DKB Giro" contains a credit of 500,00 € dated 2026-09-02 without a counterparty IBAN
When the user uploads the statement and selects "DKB Giro" as the account in the preview
Then the preview row is suggested as the counter-booking of that transfer
And the row is excluded from the import by default
```

**Notes:** Stored transfer seeded via `POST /api/transactions` with `date: "2026-09-01"`; row date 2026-09-02. Expect basis `match`.

---

### TC-017-08 — Outgoing debit without IBAN matched against a stored incoming credit

**Maps to:** AC-017-08
**Type:** integration
**File:** `tests/server/api/transfers.test.ts`

```gherkin
Given a stored income transaction of 300,00 € on "DKB Giro" dated 2026-09-10
And a statement for "N26" contains a debit of 300,00 € dated 2026-09-09 without a counterparty IBAN
When the user uploads the statement and selects "N26" as the account in the preview
Then the preview row shows "Umbuchung" with the target account "DKB Giro"
And the row shows "Ersetzt Einnahme vom 10.09.2026"
```

**Notes:** Expect `{ kind: "transfer", targetAccountId: <DKB Giro>, basis: "match", replacesTransaction: { id: <stored income id>, date: "2026-09-10" } }`. The hint text "Ersetzt Einnahme vom 10.09.2026" is asserted in TC-017-14 (E2E).

---

### TC-017-09 — Amount difference or date outside the window prevents a match

**Maps to:** AC-017-09
**Type:** integration
**File:** `tests/server/api/transfers.test.ts`

```gherkin
Given a stored transaction of type "transfer" from "N26" to "DKB Giro" of 500,00 € dated 2026-09-01
And a statement for "DKB Giro" contains a credit of 500,00 € dated 2026-09-10 without a counterparty IBAN
When the user uploads the statement and selects "DKB Giro" as the account in the preview
Then the preview row is an income
And it is included in the import by default
```

**Notes:** Row date 2026-09-10 vs. stored 2026-09-01 → `none`. Add a second `it()` for the amount case (500,00 vs. 500,01 on the same date → `none`). Both belong to this TC.

---

### TC-017-10 — Ambiguous match yields no suggestion

**Maps to:** AC-017-10
**Type:** integration
**File:** `tests/server/api/transfers.test.ts`

```gherkin
Given two stored outgoing transfers of 500,00 € from different own accounts to "DKB Giro" within the matching window
And a statement for "DKB Giro" contains a credit of 500,00 € without a counterparty IBAN
When the user uploads the statement and selects "DKB Giro" as the account in the preview
Then the preview row is an income
And no counter-booking is suggested
```

**Notes:** Three accounts: "N26" and "ING" each with a stored 500 € transfer to "DKB Giro" within the window → `none`.

---

### TC-017-11 — User can override a detected transfer

**Maps to:** AC-017-11
**Type:** e2e
**File:** `tests/e2e/importTransfers.spec.ts`

```gherkin
Given a preview row marked as a transfer to "DKB Giro"
When the user selects "Keine Umbuchung" as the target account and clicks "Importieren"
Then the transaction is stored with type "expense"
And transferToAccountId is null
```

**Notes:** Setup via API (accounts with IBAN). `page.route("**/api/import/pdf", …)` fulfills a synthetic ParseResult with a `counterpartyIban`, so no PDF fixture is needed. `/api/transfers/detect` and the batch run against the real E2E server. Select "Keine Umbuchung" in `select-transfer-target-0`, import, then assert via `GET /api/transactions?month=2026-09`: `type: "expense"`, `transferToAccountId: null`. Also asserts the "Umbuchung" marker (`transfer-marker-0`) before the override (AC-017-01 UI part).

---

### TC-017-12 — User can import a counter-booking anyway

**Maps to:** AC-017-12
**Type:** e2e
**File:** `tests/e2e/importTransfers.spec.ts`

```gherkin
Given a preview row marked as a counter-booking and excluded by default
When the user re-includes the row and clicks "Importieren"
Then the transaction is stored as an income on the selected account
```

**Notes:** Same interception as TC-017-11 with a credit row. Assert `transfer-marker-0` shows "Gegenbuchung von N26" and the row checkbox is unchecked. Then re-check it, import, and assert the stored `type: "income"` via API.

---

### TC-017-13 — Detection applies to the Paperless import

**Maps to:** AC-017-13
**Type:** integration
**File:** `tests/server/api/paperless.test.ts`

```gherkin
Given own accounts "N26" and "DKB Giro" with IBANs exist
And a Paperless document for "N26" contains a debit whose counterparty IBAN is the IBAN of "DKB Giro"
When the user loads the document into the Paperless import preview
Then the preview row is marked as a transfer to "DKB Giro"
```

**Notes:** In the existing file: `parsePDF` mock returns a transaction with `counterpartyIban` of "DKB Giro". `POST /api/paperless/documents/:id/import` → response keeps `counterpartyIban`, then `POST /api/transfers/detect` with the mapped account → `transfer` to "DKB Giro". Rendering is the same `TransferCell` as the PDF page (TC-017-11).

---

### TC-017-14 — Importing a transfer deletes the stored income it replaces

**Maps to:** AC-017-14
**Type:** e2e
**File:** `tests/e2e/importTransfers.spec.ts`

```gherkin
Given a stored income transaction of 300,00 € on "DKB Giro" dated 2026-09-10
And a preview row for a debit of 300,00 € on "N26" shows "Umbuchung" to "DKB Giro" and "Ersetzt Einnahme vom 10.09.2026"
When the user clicks "Importieren"
Then a transaction of type "transfer" from "N26" to "DKB Giro" of 300,00 € is stored
And the stored income transaction on "DKB Giro" no longer exists
And GET /api/summary/2026-09 counts the 300,00 € as a transfer only, not as income of "DKB Giro"
```

**Notes:** Seed the stored income via API, intercept the parse with a debit without IBAN, and assert `transfer-replaces-0` shows "Ersetzt Einnahme vom 10.09.2026". Import, then via API: the income id is gone, a transfer exists, and `GET /api/summary/2026-09` has `totalIncome` of "DKB Giro" = 0 and `transfersIn` = 300.

---

### TC-017-15 — Overriding the transfer keeps the stored income

**Maps to:** AC-017-15
**Type:** e2e
**File:** `tests/e2e/importTransfers.spec.ts`

```gherkin
Given a preview row that shows "Umbuchung" to "DKB Giro" and "Ersetzt Einnahme vom 10.09.2026"
When the user selects "Keine Umbuchung" as the target account and clicks "Importieren"
Then the row is stored as an expense on "N26"
And the stored income transaction on "DKB Giro" still exists
```

**Notes:** As TC-017-14, but select "Keine Umbuchung" before importing. Then the income id still exists (`GET /api/transactions`) and the new row is an expense.

---

### TC-017-16 — Transfer detected by IBAN also replaces a matching stored income

**Maps to:** AC-017-16
**Type:** integration
**File:** `tests/server/api/transfers.test.ts`

```gherkin
Given own accounts "N26" and "DKB Giro" exist and "DKB Giro" has the IBAN "DE02120300000000202051"
And a stored income transaction of 500,00 € on "DKB Giro" dated 2026-09-02
And a statement for "N26" contains a debit of 500,00 € dated 2026-09-01 whose counterparty IBAN is "DE02120300000000202051"
When the user uploads the statement and selects "N26" as the account in the preview
Then the preview row shows "Umbuchung" with the target account "DKB Giro"
And the row shows "Ersetzt Einnahme vom 02.09.2026"
```

**Notes:** Also add a second `it()`: two stored incomes of 500 € on "DKB Giro" in the window → still `transfer` basis `iban`, but `replacesTransaction: null` (ARCH-017 rule 4).

---

### TC-017-17 — Failed deletion of a replaced income is reported

**Maps to:** AC-017-17
**Type:** e2e
**File:** `tests/e2e/importTransfers.spec.ts`

```gherkin
Given a preview row that shows "Ersetzt Einnahme vom 10.09.2026"
And the server rejects the request that deletes the replaced income transaction
When the user clicks "Importieren"
Then the transfer is stored
And the user sees "Einnahme vom 10.09.2026 konnte nicht entfernt werden"
```

**Notes:** As TC-017-14 plus `page.route("**/api/transactions/*", …)` fulfilling `DELETE` with status 500. Assert the toast "Einnahme vom 10.09.2026 konnte nicht entfernt werden" and that the transfer is stored (via API).

---

### TC-017-18 — parseN26 captures the counterparty IBAN of a booking

**Maps to:** REQ-017 Notes (parser change), ARCH-017
**Type:** unit
**File:** `tests/server/unit/pdfParser.test.ts`

```gherkin
Given an N26 statement text with an "IBAN: DE02 1203 0000 0000 2020 51" line in the block of a booking
When the statement is parsed
Then the booking has the counterpartyIban "DE02120300000000202051"
And a booking without an IBAN line has the counterpartyIban null
```

**Notes:** Synthetic fixture text only, using public example IBANs (security.md). The lookback must not take the IBAN of the previous booking: the fixture has two bookings, and only the second one has an IBAN line.

---

### TC-017-19 — parseDKB captures the counterparty IBAN of a booking

**Maps to:** REQ-017 Notes (parser change), ARCH-017
**Type:** unit
**File:** `tests/server/unit/pdfParser.test.ts`

```gherkin
Given a DKB statement text with an "IBAN DE02120300000000202051" line directly above a booking
When the statement is parsed
Then the booking has the counterpartyIban "DE02120300000000202051"
And its description is unchanged
```

**Notes:** Extends the existing fixture in `describe("parseDKB")`; the description assertion guards against regressing TC-005-01.

---

### TC-017-20 — IBAN extraction rejects malformed and oversized input

**Maps to:** REQ-017 Notes (parser change), ARCH-017
**Type:** unit
**File:** `tests/server/unit/pdfParser.test.ts`

```gherkin
Given a statement line "IBAN: XX" or a line longer than the length limit
When the IBAN is extracted
Then the counterpartyIban is null
```

**Notes:** Tested through `parseN26` (no export needed for a private helper). The length limit is the ReDoS guard from security.md / REQ-005.

---

### TC-017-21 — Detect endpoint validates its input

**Maps to:** ARCH-017 (Design)
**Type:** integration
**File:** `tests/server/api/transfers.test.ts`

```gherkin
Given a detection request with 501 rows, a negative amount, or a counterpartyIban longer than 42 characters
When POST /api/transfers/detect is called
Then the response status is 400
```

**Notes:** One `it()` per invalid shape is fine; security.md: Zod `.safeParse()`, reject early.

---

### TC-017-22 — One stored transaction is never claimed by two rows

**Maps to:** ARCH-017 (Design)
**Type:** integration
**File:** `tests/server/api/transfers.test.ts`

```gherkin
Given one stored transfer of 500,00 € from "N26" to "DKB Giro" dated 2026-09-01
And two credit rows of 500,00 € on "DKB Giro" dated 2026-09-01 and 2026-09-02 without a counterparty IBAN
When POST /api/transfers/detect is called with both rows
Then both suggestions are "none"
```

**Notes:** ARCH-017 rule 5 (claim check); extends AC-017-10 across rows.
