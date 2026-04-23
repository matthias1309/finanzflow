# REQ-009 — Sankey Cash Flow Diagram

## User Story

As a user,  
I want to see my monthly cash flow visualized as a Sankey diagram,  
so that I can intuitively understand where my money comes from, which accounts it flows through, and where it goes.

## Background

The Sankey diagram is the signature visualization of FinanzFlow (hence the project name). It renders a three-layer flow chart: income categories on the left, accounts in the center, and expense categories on the right. The width of each flow band is proportional to the monetary amount. Inter-account transfers are shown as horizontal flows between account nodes. The chart uses D3.js with the d3-sankey layout algorithm.

## Diagram Structure

```
[Income Categories]  →  [Accounts]  →  [Expense Categories]
  Gehalt                 Girokonto       Wohnen & Nebenkosten
  Nebeneinkommen         Sparkonto       Lebensmittel
                                         Freizeit & Sport
                    ↔ (Transfers between accounts)
```

## Acceptance Criteria

```gherkin
Feature: Sankey Cash Flow Diagram

  Scenario: Diagram renders with income and expense flows
    Given an account "Girokonto" has income of 2000€ from "Gehalt"
    And expenses of 500€ in "Lebensmittel" and 300€ in "Wohnen & Nebenkosten"
    When the user views the Dashboard for that month
    Then the Sankey diagram shows a node for "Gehalt" on the left
    And a node for "Girokonto" in the center
    And nodes for "Lebensmittel" and "Wohnen & Nebenkosten" on the right
    And flow bands connect them with width proportional to their amounts

  Scenario: Inter-account transfers are shown as horizontal flows
    Given a transfer of 500€ from "Girokonto" to "Sparkonto"
    Then a horizontal flow band connects "Girokonto" to "Sparkonto" in the center layer
    And the flow is shown in a distinct teal color (#4f98a3)

  Scenario: Hidden accounts are excluded from the diagram
    Given "Sparkonto" is toggled hidden on the Dashboard
    Then "Sparkonto" does not appear as a node in the Sankey chart
    And flows to and from "Sparkonto" are not rendered

  Scenario: Empty accounts are excluded from the diagram
    Given an account "Leer-Konto" has no transactions for the selected month
    Then "Leer-Konto" does not appear in the Sankey chart

  Scenario: Diagram adapts to dark and light mode
    When the user is in dark mode
    Then node labels are rendered in a light color (#c9c8c6)
    And income flows are green (#6daa45)
    And expense flows are red (#f87171)
    When the user switches to light mode
    Then node labels are dark (#374151)
    And income flows are darker green (#15803d)
    And expense flows are darker red (#dc2626)

  Scenario: Loading state shows skeleton placeholder
    When the summary data is being fetched
    Then three skeleton rows are shown in place of the Sankey diagram

  Scenario: Diagram is shown for the selected month
    When the user changes the month selector to "März 2026"
    Then the Sankey header updates to "Sankey — März 2026"
    And the diagram reflects transactions for March 2026
```

## Notes

- The chart height is calculated dynamically: `max(520px, rowCount × 56 + 60)` where rowCount is the number of nodes in the largest layer, ensuring the chart scales to the data.
- Node width is 16px, node padding is 12px. The `nodeAlign` is set to "left" (D3 Sankey default).
- Category and account colors from the database are used for flow coloring. Colors are sanitized via `safeCssColor` before use in SVG `fill`/`stroke` attributes.
- The chart is rendered as an SVG element and is not interactive (no click or hover effects on individual nodes or links in the current implementation).
