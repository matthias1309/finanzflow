# REQ-002 — Account Management

## User Story

As a user,  
I want to create and manage my bank accounts in the application,  
so that I can assign transactions to the right account and see per-account financial summaries.

## Background

An account represents a real-world bank or financial account (e.g., a checking account at ING, a savings account, a cash wallet). Each transaction belongs to exactly one account. Accounts can be color-coded for visual identification throughout the app (charts, badges, cards).

## Data Model

| Field  | Type   | Required | Notes |
|--------|--------|----------|-------|
| name   | string | yes      | Free-text label |
| bank   | string | yes      | One of: ING, DKB, N26, Sparkasse, Deutsche Bank, Volksbank, Sonstige |
| type   | string | yes      | One of: checking, savings, rental, investment, cash |
| color  | string | yes      | Hex color: `#rrggbb` or `#rgb` |
| iban   | string | no       | Must match `^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$` if provided |

## Acceptance Criteria

```gherkin
Feature: Account Management

  Scenario: Create a new account
    Given the user is on the Accounts page
    When the user clicks "Neues Konto"
    And fills in name "Girokonto", bank "ING", type "checking", color "#01696f"
    And submits the form
    Then the new account appears in the account list
    And a success toast is shown

  Scenario: Create account with IBAN validation
    Given the user is on the Accounts page
    When the user fills in an invalid IBAN "DE00"
    And submits the form
    Then the form shows a validation error on the IBAN field
    And no account is created

  Scenario: Edit an existing account
    Given an account "Girokonto" exists
    When the user clicks the edit icon on that account
    And changes the name to "Gehaltskonto"
    And saves
    Then the account name is updated to "Gehaltskonto"
    And a success toast is shown

  Scenario: Delete an account
    Given an account "Testkonto" exists with no transactions
    When the user clicks the delete icon and confirms
    Then the account is removed from the list

  Scenario: Invalid color is rejected
    When the user submits an account with color "notacolor"
    Then the API returns status 400
    And the error indicates the color field is invalid

  Scenario: Account list is displayed on the Accounts page
    Given three accounts exist
    When the user navigates to the Accounts page
    Then all three accounts are visible with their name, bank badge, and color dot
```

## Notes

- Deleting an account does not cascade-delete its transactions in the current implementation. Orphaned transactions remain in the database but are no longer accessible via the account UI.
- Color is sanitized server-side and in the frontend (`safeCssColor`) before being injected into `style` attributes, preventing CSS injection.
