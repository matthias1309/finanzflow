# REQ-004 — Transaction Management

## User Story

As a user,  
I want to view, create, edit, and delete individual financial transactions,  
so that I can maintain an accurate and up-to-date record of my income, expenses, and transfers.

## Background

Transactions are the core data of FinanzFlow. Each transaction belongs to one account and optionally one category. There are three types: income, expense, and transfer (between own accounts). The Transactions page lets users view all transactions for a selected month and account, and manage them manually. Transactions imported via PDF are also shown here.

## Data Model

| Field               | Type    | Required | Notes |
|---------------------|---------|----------|-------|
| month               | string  | yes      | Format: `YYYY-MM` |
| date                | string  | no       | Format: `YYYY-MM-DD` (from PDF import) |
| description         | string  | yes      | Payee name or purpose |
| amount              | number  | yes      | Positive value; type determines sign |
| accountId           | integer | yes      | Foreign key to accounts |
| categoryId          | integer | no       | Foreign key to categories; nullable |
| type                | string  | yes      | `"income"`, `"expense"`, or `"transfer"` |
| transferToAccountId | integer | no       | Required when type is `"transfer"` |
| importSource        | string  | no       | `"manual"` or `"pdf"` |
| originalText        | string  | no       | Raw line from PDF, for reference |

## Acceptance Criteria

```gherkin
Feature: Transaction Management

  Scenario: View transactions for the current month
    Given transactions exist for "2026-04"
    When the user navigates to the Transactions page
    Then transactions for the current month are listed
    And each row shows description, amount, category, and date

  Scenario: Filter transactions by month
    Given transactions exist for "2026-03" and "2026-04"
    When the user selects "März 2026" in the month filter
    Then only March transactions are shown

  Scenario: Filter transactions by account
    Given two accounts "Girokonto" and "Sparkonto" exist with transactions
    When the user selects "Girokonto" in the account filter
    Then only transactions belonging to "Girokonto" are shown

  Scenario: Create a manual income transaction
    Given at least one account and one income category exist
    When the user clicks "Neue Buchung"
    And enters description "Freelance Projekt", amount 500, type "income"
    And selects account "Girokonto" and category "Nebeneinkommen"
    And submits
    Then the transaction appears in the list for the current month
    And the amount is shown as "+500,00 €"

  Scenario: Create a transfer between accounts
    Given accounts "Girokonto" and "Sparkonto" exist
    When the user creates a transaction of type "transfer"
    Then a "target account" selector appears
    When the user selects "Sparkonto" as target and amount 200
    And submits
    Then the transfer appears in the list
    And the target account field shows "Sparkonto"

  Scenario: Transfer requires a target account
    When the user sets transaction type to "transfer"
    And does not select a target account
    And submits the form
    Then a validation error is shown on the target account field

  Scenario: Edit a transaction's category
    Given a transaction without a category exists
    When the user clicks the edit icon on that transaction
    And selects a category "Lebensmittel"
    And saves
    Then the transaction now shows category "Lebensmittel"

  Scenario: Delete a transaction
    Given a transaction "Miete" exists
    When the user clicks the delete icon and confirms
    Then the transaction is removed from the list

  Scenario: Amount must be positive
    When the user submits a transaction with amount -50
    Then the API returns status 400
    And the error indicates the amount must be a positive number

  Scenario: Month format is validated
    When the API receives a transaction with month "April-2026"
    Then the response status is 400
    And the error indicates the month format must be YYYY-MM
```

## Notes

- The amount is always stored as a positive number. The `type` field determines whether it represents money coming in (income) or going out (expense/transfer).
- Category selection is filtered by type: only income categories are shown when type is "income", only expense categories when type is "expense". Transfers always use the built-in "Kontoübertrag" category.
- Batch creation of up to 500 transactions is supported via `POST /api/transactions/batch` (used by the PDF import flow).
