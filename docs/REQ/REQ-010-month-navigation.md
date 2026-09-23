# REQ-010 — Month Filtering & Navigation

## User Story

As a user,  
I want to select any month for which I have transaction data and view the Dashboard and Transactions for that month,  
so that I can review my historical finances and compare different time periods.

## Background

All financial data in FinanzFlow is organized by month (stored as `YYYY-MM`). The Dashboard and Transactions pages both have a month selector. The available months are determined by which months actually have transactions in the database. The current month is always available in the selector, even if empty, so the user always has a default view.

## Acceptance Criteria

```gherkin
Feature: Month Filtering & Navigation

  Scenario: Current month is selected by default
    Given today is 2026-04-23
    When the user opens the Dashboard
    Then the month selector shows "April 2026"
    And KPIs reflect data for April 2026

  Scenario: Month selector shows all months with data
    Given transactions exist in "2026-01", "2026-02", and "2026-04"
    When the user opens the month selector dropdown
    Then the list contains "April 2026", "Februar 2026", and "Januar 2026"
    And months are shown in descending order (newest first)

  Scenario: Current month is always in the selector even without data
    Given no transactions exist for the current month
    When the user opens the month selector
    Then the current month is still present in the list

  Scenario: Selecting a different month updates the Dashboard
    Given the user is viewing "April 2026"
    When the user selects "März 2026"
    Then the KPI cards update to reflect March totals
    And the Sankey chart redraws for March data
    And the month selector shows "März 2026"

  Scenario: Selecting a different month updates the Transactions page
    Given the user is on the Transactions page viewing "April 2026"
    When the user selects "Februar 2026"
    Then the transaction list shows only February transactions

  Scenario: Month format is validated on the API
    When the API receives a request for summary with month "2026-4" (missing leading zero)
    Then the response status is 400
    And the error indicates the format must be YYYY-MM

  Scenario: Month names are displayed in German locale
    Given the month selector contains historical months
    Then months are formatted as "April 2026", "März 2026", "Februar 2026"
    And not as "April 2026", "March 2026" (no English month names)
```

## Notes

- Month strings are stored as `YYYY-MM` in the database and in all API requests/responses.
- `GET /api/months` returns the distinct months from the transactions table, sorted descending. The frontend merges this with the current month to guarantee the current month is always in the selector.
- Month formatting in the UI uses `Date.toLocaleDateString("de-DE", { month: "long", year: "numeric" })`.
