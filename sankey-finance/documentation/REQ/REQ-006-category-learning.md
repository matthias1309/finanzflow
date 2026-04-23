# REQ-006 — Automatic Category Suggestion (Learning System)

## User Story

As a user,  
I want the application to remember which categories I assign to transactions from specific payees,  
so that future imports from the same payees are automatically pre-categorized and I spend less time on manual classification.

## Background

The category learning system observes which categories the user assigns to transactions after a PDF import. It extracts a keyword from the transaction description (typically the payee name) and stores a mapping of `keyword → categoryId`. On subsequent imports, if a transaction description contains a known keyword, the corresponding category is automatically suggested. The user can always override suggestions before confirming an import.

## Learning Logic

1. **Keyword extraction** from description:
   - If the description contains " – " or " - ", take the left side (payee name)
   - Take the first token (word) if it is ≥ 4 characters
   - Otherwise take the first 30 characters
   - Minimum keyword length: 3 characters

2. **Suggestion algorithm** (longest match wins):
   - Normalize the transaction description to lowercase
   - Find all stored keywords that are substrings of the description
   - Return the category of the longest matching keyword
   - On equal length, prefer the keyword with more hits (higher confidence)

3. **Learning trigger**: only called when the user confirms an import via `POST /api/category-rules/learn`; individual manual transactions do not trigger learning.

## Acceptance Criteria

```gherkin
Feature: Automatic Category Suggestion

  Scenario: Category is suggested for a known payee on next import
    Given the user previously imported a transaction "REWE Markt" and assigned category "Lebensmittel"
    And the import was confirmed
    When the user imports a new PDF containing a transaction "REWE Markt Hamburg"
    Then the category "Lebensmittel" is pre-selected for that transaction
    And a sparkles icon indicates the category was auto-suggested

  Scenario: Longer keyword takes precedence over shorter one
    Given a rule: keyword "REWE" → "Lebensmittel"
    And a rule: keyword "REWE Markt" → "Sonstige Ausgaben"
    When a transaction "REWE Markt Berlin" is imported
    Then category "Sonstige Ausgaben" is suggested (longer keyword wins)

  Scenario: Manual override clears auto-suggestion flag
    Given a transaction in the preview has auto-suggested category "Lebensmittel"
    When the user changes the category to "Freizeit & Sport"
    Then the sparkles icon disappears
    And after confirming import, "Lebensmittel" is not learned for this transaction

  Scenario: Auto-suggested categories are learned on import confirmation
    Given a transaction in the preview has auto-suggested category "Lebensmittel" (not overridden)
    When the user confirms the import
    Then the hit count for the "REWE" → "Lebensmittel" rule is incremented

  Scenario: No suggestion when payee is unknown
    Given no rules exist for the keyword "Neuer Anbieter"
    When a transaction "Neuer Anbieter GmbH" is imported
    Then no category is pre-selected for that transaction
    And the category field is empty

  Scenario: Keyword must be at least 3 characters to be learned
    When the user confirms an import with a transaction whose keyword would be "TV" (2 chars)
    Then no category rule is created for that transaction

  Scenario: Learning accepts up to 500 entries per batch
    When the client sends a learn request with 500 entries
    Then all valid entries are processed
    And the response confirms success

  Scenario: Invalid entries in learn batch are skipped
    When the client sends a learn batch where one entry has a negative categoryId
    Then that entry is skipped
    And valid entries in the same batch are still processed
```

## Notes

- Rules are stored in the `categoryRules` table with `keyword` (unique), `categoryId`, and `hits` columns.
- The `hits` counter is incremented each time the same keyword is confirmed (with the same category). If a keyword is already known but confirmed with a *different* category, the category is updated and hits incremented.
- This system intentionally learns only from confirmed PDF imports, not from manual transaction creation, to keep the learned rules meaningful.
