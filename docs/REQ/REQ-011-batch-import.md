# REQ-011 — Batch Transaction Import

## User Story

As a user confirming a PDF import,  
I want all parsed transactions to be saved in a single operation,  
so that the import is atomic and I do not end up with partially imported data.

## Background

After parsing a PDF and reviewing the transaction preview, the user confirms the import. The frontend sends all transactions in a single batch request (`POST /api/transactions/batch`). The server validates each transaction individually and returns a summary of what was created and what failed. Rate limiting prevents abuse of this endpoint. Immediately after saving, the client sends a second request (`POST /api/category-rules/learn`) to update the category learning system.

## Acceptance Criteria

```gherkin
Feature: Batch Transaction Import

  Scenario: All valid transactions are saved in one request
    Given a PDF import preview with 30 transactions
    When the user clicks "Importieren"
    Then a single POST /api/transactions/batch request is made
    And the response contains 30 created transactions
    And the user sees a success message

  Scenario: Invalid items in the batch are skipped, valid ones are saved
    Given a batch of 10 transactions where 1 has an invalid account ID
    When the batch request is sent
    Then 9 transactions are created
    And the response includes a "skipped" count of 1
    And the "errors" array describes which item failed and why

  Scenario: Batch size is limited to 500 transactions
    When the client sends a batch with 501 transactions
    Then the API returns status 400
    And the error indicates the batch exceeds the maximum size

  Scenario: Batch endpoint is rate-limited
    Given the same IP has sent 20 batch requests within 15 minutes
    When a 21st batch request is sent
    Then the response status is 429

  Scenario: Category learning is triggered after successful import
    Given the batch import completed successfully
    When category rules are sent via POST /api/category-rules/learn
    Then rules for all transactions with confirmed categories are stored
    And future imports from the same payees will have pre-suggested categories

  Scenario: Learn batch validates entry structure
    When the learn endpoint receives an entry with a description longer than 200 characters
    Then that entry is skipped
    And the response still processes valid entries in the same batch
```

## Notes

- The batch endpoint uses partial success: one invalid transaction does not prevent the rest from being saved. The response always includes `created` (array), `skipped` (count), and `errors` (array of `{idx, errors}`) so the client can show an accurate summary.
- The learn endpoint (`POST /api/category-rules/learn`) accepts up to 500 entries. Each entry requires `description` (1–200 chars) and `categoryId` (positive integer).
- Both endpoints share the same 20-requests/15-min rate limit per IP.
