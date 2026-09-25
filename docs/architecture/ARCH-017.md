# ARCH-017 — Transfer Detection in the Import Preview

**Status:** draft
**Created:** 2026-09-25
**Traces:** REQ-017
**Verified by:** _(pending TEST-SPEC)_

## Summary

Pre-fills the import preview ([ARCH-005](ARCH-005.md), [ARCH-016](ARCH-016.md)) with transfer
suggestions: a debit to another own account becomes `type = "transfer"` with
`transferToAccountId`, and a credit from another own account is marked as a *counter-booking*
and is excluded from the import by default, so it is not counted twice (REQ-004 AC-004-11). Detection is a
stateless, read-only server step. It runs after parsing and again whenever the account
selection in the preview changes. Nothing is persisted until the user clicks "Importieren", and
the save path ([ARCH-011](ARCH-011.md)) stays unchanged. System context: `ARC42.md` §5.2, §5.3,
§6.6, ADR-011.

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `ParsedTransaction.counterpartyIban` | `server/pdfParser.ts` | New field `string \| null`: the counterparty IBAN found in the booking's block, normalized. It is `null` when the parser has none |
| `extractIban` | `server/pdfParser.ts` | Pulls one IBAN out of a statement line (length-limited regex), then normalizes it (whitespace removed, upper-cased) and checks it against the `ibanSchema` pattern. Returns `null` if the check fails |
| `detectTransfers` | `server/transferDetection.ts` | Pure function `(options: { rows, accounts, candidates }) → TransferSuggestion[]`. Contains all matching rules, no I/O |
| `transfersRouter` | `server/routes/transfers.ts` | `POST /api/transfers/detect`: validates the request with Zod, loads accounts and candidate transactions through `storage`, calls `detectTransfers` |
| `getTransactionsBetweenDates` | `server/storage.ts` | New `IStorage` method `(fromDate, toDate) → Transaction[]` that filters on the ISO `date` column |
| `detectTransfersRequestSchema`, `TransferSuggestion` | `shared/schema.ts` | Request validation and response types, shared by server and client |
| `transferDetection` helpers | `client/src/lib/transferDetection.ts` | `fetchTransferSuggestions(rows)` and the pure `applyTransferSuggestion(row, suggestion)` |
| `TransferCell` | `client/src/components/TransferCell.tsx` | Preview cell that shows the marker and the target-account select. Used by both import pages |

**API contract: `POST /api/transfers/detect`**

Protected by `requireAuth` and CSRF like every other `/api` route. It is read-only.

```
Request  { rows: Array<{
             accountId:        number | null,     // the row's selected account in the preview
             date:             string | null,     // YYYY-MM-DD
             amount:           number,            // > 0
             type:             "income" | "expense",
             counterpartyIban: string | null      // max 42 chars
           }> }                                   // 1–500 rows, same limit as the batch import

Response 200 { suggestions: TransferSuggestion[] }   // same length and order as rows

TransferSuggestion =
    { kind: "none" }
  | { kind: "transfer",      targetAccountId: number, basis: "iban" | "match" }
  | { kind: "counterBooking", sourceAccountId: number, basis: "iban" | "match" }

400  invalid body (Zod safeParse, flattened error), same shape as the other routes
```

**Detection rules (`detectTransfers`)**

For each row, in this order. The first rule that applies decides.

1. `accountId` is `null` → `none` (no account selected yet).
2. **IBAN strategy.** `counterpartyIban` is set. The server looks it up in a map from normalized
   IBAN to account id, built from `accounts.iban`. Stored IBANs are normalized too.
   - No own account has this IBAN → `none` (AC-017-04). The row has a foreign counterparty, so
     the match strategy is **not** tried.
   - The IBAN belongs to the row's own `accountId` → `none` (AC-017-05). This also covers the
     statement owner's IBAN in the page header, when it is picked up for the first booking.
   - Another own account Y, row is an `expense` → `transfer` to Y, basis `iban` (AC-017-01, 06, 13).
   - Another own account Y, row is an `income` → `counterBooking` from Y, basis `iban` (AC-017-03).
3. **Match strategy.** `counterpartyIban` is `null` and `date` is set. The candidates are the
   stored transactions with `accountId ≠ row.accountId`, an equal amount in cents
   (`Math.round(amount * 100)`, so floating-point noise does not matter) and
   `|date − row.date| ≤ 3 days`:
   - Row is an `income` → candidates with `type = "transfer"` and
     `transferToAccountId = row.accountId` → `counterBooking` from the candidate's account
     (AC-017-07).
   - Row is an `expense` → candidates with `type = "income"` → `transfer` to the candidate's
     account (AC-017-08).
   - Exactly one candidate → suggestion with basis `match`. Zero or several → `none`
     (AC-017-09, AC-017-10).
4. **Claim check.** If two rows in the same request matched the same stored candidate, all of
   them fall back to `none`. The ambiguity rule applies across rows as well.

**Candidate query**

The route computes `[min(row.date) − 3 days, max(row.date) + 3 days]` over all rows and loads
that range with a single `storage.getTransactionsBetweenDates` call. Matching happens in memory.
Rows and stored transactions without a `date` never match.

**Parser changes (REQ-005)**

- **N26:** the lookback before the transaction line currently skips `IBAN:` lines. Instead it
  captures them with `extractIban`. The lookback already stops at the previous transaction line,
  so an IBAN it captures belongs to the current booking.
- **DKB:** the `IBAN DE…` line directly above the transaction line is captured the same way.
- **ING, Trade Republic, generic fallback:** `counterpartyIban: null` until real statements show
  where the IBAN sits (Open Question 2). These rows rely on the match strategy only.
- `parsePDF`'s dedup key (`date|description|amount`) stays unchanged.

**Client flow**

```
parse result ──► rows (type from parser, transferHint = none, isAutoTransfer = true)
     │
     ├─ after upload / after Paperless parse
     └─ after every account change (per row, "Alle: Konto setzen", Paperless account select)
            ▼
   POST /api/transfers/detect (all rows)
            ▼
   applyTransferSuggestion(row, suggestion), only for rows with isAutoTransfer = true:
     transfer        → type "transfer", transferToAccountId = target, marker "Umbuchung"
     counterBooking  → skip = true, marker "Gegenbuchung"
     none            → type = parsed type, transferToAccountId = null, skip unchanged
```

- `TransferCell` shows `Umbuchung` together with a target-account select (all own accounts
  except the row's account, plus the option `Keine Umbuchung`), or it shows `Gegenbuchung von
  <Konto>`. Any manual change sets `isAutoTransfer = false`, so later re-detection never
  overrides the user (AC-017-11). Checking a counter-booking row again imports it as an
  `income`, as parsed (AC-017-12).
- The batch payload sends `type` and `transferToAccountId` from the row instead of the hard-coded
  `transferToAccountId: null`. `POST /api/transactions/batch` already accepts `type: "transfer"`
  (AC-017-02). Category learning is unchanged.
- `data-testid`: `transfer-marker-{idx}`, `select-transfer-target-{idx}`.

## Key Decisions

- **Separate detect endpoint instead of extending the parse endpoints.** Neither
  `POST /api/import/pdf` nor the Paperless import knows the account. The account is picked in
  the preview, per row, and can change after the upload. A second call that is re-run on
  account change fits this flow without re-uploading the PDF. It also keeps `parsePDF` free of
  database access.
- **Matching rules on the server, in a pure function.** Unit tests cover them without a DB or a
  browser, following the pattern in `testing-practices.md`. The client only applies the result.
  One implementation serves both import pages.
- **Counterparty IBAN only in transit, never stored.** YAGNI, and it keeps personal data out of
  the database. The IBAN already travels to the browser today inside `rawText`, so the new field
  exposes nothing new. No schema change and no `ALTER TABLE`.
- **A known foreign IBAN disables the match strategy.** If the statement names the counterparty,
  the heuristic has nothing to add. A same-amount coincidence must not override hard evidence.
- **Fail safe on ambiguity.** Several candidates, or one candidate claimed by several rows,
  produce no suggestion. A wrong transfer silently moves money between accounts in the
  dashboard. A missed transfer is visible and easy to fix by hand.
- **Window ±3 calendar days, exact amount in cents.** SEPA transfers between German banks
  settle within 1–2 business days. Three calendar days covers a weekend. Amounts are never
  rounded or fuzzy-matched: fees would make the two sides differ, and then they are not a pure
  transfer.
- **Counter-bookings are skipped, not stored with a link.** The existing model shows the target
  side through the source row's `transferToAccountId` (summary `transfersIn`). A second row
  would need a new column and changes to the summary code. Trade-off: if the source statement is
  never imported, the target account's balance lacks that inflow. The user sees the
  `Gegenbuchung` marker and can include the row.

## Out of Scope

- Converting or deleting stored transactions. Detection only changes the rows being imported
  (see Open Question 1 for the AC-017-08 consequence).
- Matching a new credit against a stored **expense** on another account (a transfer imported
  earlier as a plain expense). The stored row is already wrong; fixing it is part of Open
  Question 1.
- Validating `transferToAccountId` in the batch endpoint (does the account exist, is it not the
  row's own account). This is pre-existing REQ-004 behavior, unchanged here.
- Cross-import duplicate detection (the same statement imported twice). Not covered by
  ARCH-005 today.
- Transfers to external accounts of the same person that are not set up as FinanzFlow accounts.

## Open Questions

1. **Stored redundant income after AC-017-08.** When a debit matches an income that is already
   stored on the target account, that income is the counter-booking and double-counts once the
   transfer is imported. Options: (a) show a hint only; (b) delete the matched income after the
   batch import (`DELETE /api/transactions/:id`, response then carries `matchedTransactionId`);
   (c) do not suggest at all. **Recommendation: (b)**, shown in the row as
   `Ersetzt Einnahme vom <Datum>`. This needs a new AC in REQ-017 before the TEST-SPEC.
2. **Where do ING, Trade Republic and the generic parser show counterparty IBANs?** This must be
   checked against a real, anonymized statement per bank. Until then those parsers return `null`.
3. **Parser fixtures.** The existing N26 and DKB fixture texts in
   `tests/server/unit/pdfParser.test.ts` must be checked for whether they contain the IBAN lines
   in their real position. Otherwise TEST-017 needs new synthetic fixtures (no real IBANs, per
   `security.md`).
