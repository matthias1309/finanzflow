# FinanzFlow — Software Requirements

This folder contains the software requirements for all features of the FinanzFlow application.
Each file follows the V-Model template: header (Status / Created / Traced by), User Story,
Background, one `### AC-NNN-YY` heading per acceptance criterion with a single Gherkin scenario,
and Notes.

## Requirements Index

| ID       | Title                              | Area        | Status |
|----------|-------------------------------------|-------------|--------|
| [REQ-001](REQ-001.md) | Authentication & Access Control    | Security    | approved |
| [REQ-002](REQ-002.md) | Account Management                 | Data        | approved |
| [REQ-003](REQ-003.md) | Category Management                | Data        | approved |
| [REQ-004](REQ-004.md) | Transaction Management             | Data        | approved |
| [REQ-005](REQ-005.md) | PDF Bank Statement Import          | Import      | approved |
| [REQ-006](REQ-006.md) | Automatic Category Suggestion      | Import      | approved |
| [REQ-007](REQ-007.md) | Dashboard & Financial Overview     | Visualization | approved |
| [REQ-008](REQ-008.md) | Account Visibility Toggle          | Visualization | approved |
| [REQ-009](REQ-009.md) | Sankey Cash Flow Diagram           | Visualization | approved |
| [REQ-010](REQ-010.md) | Month Filtering & Navigation       | Navigation  | approved |
| [REQ-011](REQ-011.md) | Batch Transaction Import           | Import      | approved |
| [REQ-012](REQ-012.md) | Dark / Light Theme                 | UI/UX       | approved |
| [REQ-013](REQ-013.md) | Two-Factor Authentication (TOTP)   | Security    | approved |
| [REQ-014](REQ-014.md) | Mobile-Responsive UI               | UI/UX       | approved |
| [REQ-015](REQ-015.md) | Multi-User Management              | Security    | approved |
| [REQ-016](REQ-016.md) | Paperless Bank Statement Import    | Import      | approved |
| [REQ-017](REQ-017.md) | Automatic Transfer Detection       | Import      | approved |

No numbering gaps.

## Document Structure

Each requirement file contains:

- **Header** — `Status`, `Created`, `Traced by` (links to the ARCH and TEST-SPEC documents once
  they exist — see `docs/MIGRATION-PLAN.md` Sessions 5–9)
- **User Story** — "As a [user], I want [feature], so that [benefit]"
- **Background** — Context, business rules, and data models relevant to the feature
- **Acceptance Criteria** — One `### AC-NNN-YY: <name>` heading per acceptance criterion, each
  with exactly one Gherkin scenario (`Given / When / Then`)
- **Notes** — Implementation details, edge cases, and constraints worth knowing

See `.claude/rules/v-model.md` for the full V-Model process and traceability conventions.
