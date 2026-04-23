# REQ-005 — PDF Bank Statement Import

## User Story

As a user,  
I want to upload a PDF bank statement from my bank,  
so that all transactions are automatically extracted and imported into FinanzFlow without manual data entry.

## Background

FinanzFlow can parse PDF bank statements from N26, DKB, and ING. The PDF is uploaded, parsed server-side, and the extracted transactions are presented as a preview table. The user reviews and adjusts categories before confirming the import. The system uses bank-specific parsers that understand each bank's PDF layout.

## Supported Banks & Detection

| Bank | Detection Keywords |
|------|--------------------|
| N26  | `ntsbdeb1`, `n26 bank`, `n26` + `balance-audit` |
| DKB  | `deutsche kreditbank`, `dkb`, `byladem1001` |
| ING  | `ing-diba`, `ing diba`, `ingddeff` |
| Generic | Fallback for all other PDFs |

## Upload Constraints

| Constraint       | Value |
|------------------|-------|
| Max file size    | 20 MB |
| Accepted MIME types | `application/pdf`, `application/x-pdf` |
| Magic bytes check | File must start with `%PDF-` |
| Processing timeout | 10 seconds |
| Rate limit       | 10 uploads per IP per 15 minutes |

## Acceptance Criteria

```gherkin
Feature: PDF Bank Statement Import

  Scenario: Upload and preview an N26 PDF
    Given the user is on the Import page
    And has selected an account to import into
    When the user uploads a valid N26 PDF statement
    Then the system detects the bank as "N26"
    And a preview table shows all parsed transactions
    And each row shows date, description, amount, and a suggested category

  Scenario: Upload and preview a DKB PDF
    When the user uploads a valid DKB PDF statement
    Then the system detects the bank as "DKB"
    And transactions are parsed with correct amounts and dates

  Scenario: Fallback to generic parser for unknown bank
    When the user uploads a PDF not matching any known bank
    Then the system attempts generic parsing
    And shows any extracted transactions in the preview

  Scenario: Non-PDF file is rejected
    When the user uploads a file with extension .xlsx
    Then the API returns status 400
    And the error message indicates the file must be a PDF

  Scenario: File exceeding size limit is rejected
    When the user uploads a PDF larger than 20 MB
    Then the upload is rejected before parsing begins
    And the error message states the file is too large

  Scenario: Corrupted PDF shows a user-friendly error
    When the user uploads a file that starts with "%PDF-" but cannot be parsed
    Then the API returns an error result with an error message
    And no transactions are shown in the preview

  Scenario: PDF with no recognizable transactions shows guidance
    When the user uploads a valid PDF with no parseable transactions
    Then the preview shows zero transactions
    And a message explains that no transactions were detected and suggests manual entry

  Scenario: User reviews and confirms import
    Given the PDF preview shows 15 transactions
    When the user selects the target account
    And clicks "Importieren"
    Then all 15 transactions are saved
    And the user is redirected or shown a success message
    And the category learning system is updated with the confirmed categories

  Scenario: User adjusts a category before importing
    Given the PDF preview shows a transaction with auto-suggested category "Lebensmittel"
    When the user changes the category to "Freizeit & Sport"
    And confirms the import
    Then the transaction is saved with category "Freizeit & Sport"
    And the auto-suggested category is not learned for this transaction

  Scenario: Rate limit is enforced
    Given the same IP has uploaded 10 PDFs within the last 15 minutes
    When the user attempts an 11th upload
    Then the response status is 429
    And the error message indicates the limit has been reached
```

## Notes

- N26 and DKB parsers limit regex matching to lines of at most 100 characters to prevent ReDoS attacks from crafted PDFs.
- Transactions are deduplicated within a single import using the composite key `date|description|amount`. True duplicates across separate imports (same transaction appearing in two statements) are not automatically detected.
- The `originalText` field stores the raw PDF line for each transaction, useful for debugging parsing issues.
- An optional environment variable `ACCOUNT_HOLDER_PATTERN` (max 500 chars, validated regex) allows skipping lines matching the account holder's name in N26 statements to avoid including personal name lines as transaction descriptions.
