# REQ-008 — Account Visibility Toggle on Dashboard

## User Story

As a user with multiple bank accounts,  
I want to temporarily hide individual accounts on the Dashboard,  
so that I can focus on specific accounts and see KPIs and the Sankey chart filtered to only the accounts I care about.

## Background

When multiple accounts exist, the Dashboard aggregates all of them. Sometimes a user wants to see their finances without a particular account — for example, to see only their personal spending accounts and exclude a shared household account. The visibility toggle lets the user click any account card to hide or show it, immediately updating all KPIs and the Sankey chart. This is a client-side filter only; no data is deleted or hidden server-side.

## Acceptance Criteria

```gherkin
Feature: Account Visibility Toggle

  Scenario: Hiding an account removes it from KPI totals
    Given the Dashboard shows two accounts: "Girokonto" (income 1000€, expenses 400€) and "Sparkonto" (income 200€, expenses 50€)
    And the total Einnahmen KPI shows "1.200,00 €"
    When the user clicks the "Sparkonto" account card to hide it
    Then the "Sparkonto" card becomes visually dimmed (40% opacity)
    And the EyeOff icon is shown on the "Sparkonto" card
    And the Einnahmen KPI updates to "1.000,00 €"
    And the Ausgaben KPI updates to "400,00 €"

  Scenario: Sankey chart excludes hidden accounts
    Given "Sparkonto" is hidden
    Then the Sankey chart does not show "Sparkonto" as a node
    And flows related to "Sparkonto" are not visible

  Scenario: Re-enabling a hidden account restores it
    Given "Sparkonto" is hidden (dimmed, EyeOff icon)
    When the user clicks the "Sparkonto" card again
    Then "Sparkonto" returns to full opacity
    And the Eye icon is shown
    And the KPIs include "Sparkonto" again

  Scenario: Multiple accounts can be hidden simultaneously
    Given three accounts exist
    When the user hides two of them
    Then only the one visible account contributes to the KPIs
    And the Sankey chart shows only that account

  Scenario: Hidden account count is shown in the Sankey header
    Given one account is hidden
    Then the Sankey card header shows "1 Konto ausgeblendet"
    When two accounts are hidden
    Then the header shows "2 Konten ausgeblendet"

  Scenario: All accounts visible by default
    When the user first opens the Dashboard
    Then all account cards are at full opacity
    And all accounts contribute to the KPIs

  Scenario: Visibility state resets on page reload
    Given the user has hidden "Sparkonto"
    When the user reloads the page
    Then all accounts are visible again
    And KPIs include all accounts
```

## Notes

- The visibility state is stored in a React `Set<number>` (account IDs) in local component state. It is intentionally not persisted — a page reload always starts with all accounts visible.
- The data fetched from the API always includes all accounts; filtering happens purely in the `useMemo` that recomputes `filteredSummary`. No API call is made when toggling visibility.
- The tooltip on hover shows "Konto einblenden" or "Konto ausblenden" depending on current state.
