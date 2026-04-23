# REQ-003 — Category Management

## User Story

As a user,  
I want to create, edit, and delete income and expense categories,  
so that I can classify my transactions and see a meaningful breakdown of where my money comes from and goes.

## Background

Categories are the classification system for transactions. Each category has a type (income or expense) and a color used in charts. The application ships with 14 default categories seeded on first start. The "Kontoübertrag" (transfer) category is a special built-in category for inter-account transfers. Users can create their own categories in addition to or instead of the defaults.

## Data Model

| Field | Type   | Required | Notes |
|-------|--------|----------|-------|
| name  | string | yes      | Free-text label |
| type  | string | yes      | `"income"` or `"expense"` |
| color | string | yes      | Hex color: `#rrggbb` or `#rgb` |

## Acceptance Criteria

```gherkin
Feature: Category Management

  Scenario: Create a new expense category
    Given the user is on the Categories page
    When the user clicks "Neue Kategorie"
    And enters name "Streaming", type "expense", color "#7a39bb"
    And clicks "Erstellen"
    Then "Streaming" appears in the Ausgabe-Kategorien section
    And a success toast "Kategorie erstellt" is shown

  Scenario: Create a new income category
    Given the user is on the Categories page
    When the user creates a category with type "income"
    Then it appears in the Einnahme-Kategorien section
    And not in the Ausgabe-Kategorien section

  Scenario: Edit an existing category
    Given a category "Lebensmittel" with color "#da7101" exists
    When the user hovers over it and clicks the pencil icon
    Then an edit dialog opens pre-filled with "Lebensmittel" and color "#da7101"
    When the user changes the name to "Supermarkt" and saves
    Then the category is renamed to "Supermarkt" in the list
    And a success toast "Kategorie gespeichert" is shown

  Scenario: Edit dialog pre-fills current values
    Given a category "Gehalt" of type "income" with color "#437a22" exists
    When the user opens the edit dialog for "Gehalt"
    Then the name field shows "Gehalt"
    And the type selector shows "Einnahme"
    And the color "#437a22" is highlighted in the color picker

  Scenario: Delete a category
    Given a category "Testkat" exists
    When the user hovers over it and clicks the trash icon
    Then the category is removed from the list
    And a success toast "Kategorie gelöscht" is shown

  Scenario: Category name is required
    When the user submits a new category with an empty name
    Then the form shows a validation error
    And no category is created

  Scenario: Categories are split by type in the UI
    Given income categories and expense categories exist
    When the user opens the Categories page
    Then income categories are shown in the left card with a green header
    And expense categories are shown in the right card with a red header
```

## Notes

- The edit and delete icons are only visible on hover (opacity transition), keeping the list clean.
- Editing a category's type (e.g., from income to expense) affects how existing transactions are displayed in the dashboard but does not change the `type` field on those transactions.
- Color choices are limited to a preset palette of 12 colors in the UI, but the API accepts any valid hex color.
