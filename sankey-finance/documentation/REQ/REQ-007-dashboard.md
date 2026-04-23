# REQ-007 — Dashboard & Financial Overview

## User Story

As a user,  
I want to see a clear monthly summary of my income, expenses, balance, and savings rate,  
so that I can quickly assess my financial situation without manually adding up numbers.

## Background

The Dashboard is the home page of FinanzFlow. It provides a month-level financial overview across all accounts. Key metrics (KPIs) are shown as cards at the top, followed by a per-account breakdown. The user can select any available month and filter which accounts contribute to the displayed totals.

## KPI Definitions

| KPI         | Formula                             | Color          |
|-------------|-------------------------------------|----------------|
| Einnahmen   | Sum of all income transactions      | Green          |
| Ausgaben    | Sum of all expense transactions     | Red            |
| Bilanz      | Einnahmen − Ausgaben                | Green if ≥ 0, red if < 0 |
| Sparquote   | (Bilanz / Einnahmen) × 100 %        | Blue           |

## Acceptance Criteria

```gherkin
Feature: Dashboard Financial Overview

  Scenario: Dashboard shows KPIs for the current month by default
    Given transactions exist for the current month
    When the user opens the Dashboard
    Then the month selector shows the current month
    And the KPI cards show the correct totals for that month

  Scenario: KPIs update when a different month is selected
    Given transactions exist for "2026-03" and "2026-04"
    When the user selects "März 2026" in the month selector
    Then all KPI cards reflect the totals for March 2026

  Scenario: Savings rate is calculated correctly
    Given income is 2000 € and expenses are 1500 € for the selected month
    Then the Bilanz card shows "+500,00 €"
    And the Sparquote card shows "25.0 %"

  Scenario: Negative balance is shown in red
    Given expenses exceed income for the selected month
    Then the Bilanz card value is displayed in red

  Scenario: Dashboard shows per-account breakdown
    Given three accounts with transactions exist for the selected month
    Then three account cards are shown below the KPI row
    And each card shows the account name, bank, total income, total expenses, and net balance

  Scenario: Empty month shows zero KPIs
    Given no transactions exist for the selected month
    Then all KPI cards show "0,00 €" or "0.0 %"
    And the Sankey chart is empty

  Scenario: No accounts shows a guidance message
    Given no accounts have been created
    Then a placeholder card with instructions is shown instead of account cards

  Scenario: Loading state shows skeleton placeholders
    When the dashboard is loading data
    Then skeleton placeholder elements are shown in place of KPI values
```

## Notes

- The month selector always includes the current month, even if no transactions exist for it, ensuring the user always has a valid selection.
- KPI values are formatted as German currency (e.g., `1.234,56 €`) using `Intl.NumberFormat` with `de-DE` locale.
- The Sparquote is only meaningful when income > 0; when income is 0, it displays "0.0 %".
