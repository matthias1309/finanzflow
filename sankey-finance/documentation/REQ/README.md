# FinanzFlow — Software Requirements

This folder contains the software requirements for all features of the FinanzFlow application. Each file follows a consistent structure: a User Story describing the feature from the user's perspective, background context, and Gherkin acceptance criteria.

## Requirements Index

| ID       | Title                              | Area        |
|----------|------------------------------------|-------------|
| [REQ-001](REQ-001-authentication.md)   | Authentication & Access Control    | Security    |
| [REQ-002](REQ-002-account-management.md) | Account Management                 | Data        |
| [REQ-003](REQ-003-category-management.md) | Category Management                | Data        |
| [REQ-004](REQ-004-transaction-management.md) | Transaction Management             | Data        |
| [REQ-005](REQ-005-pdf-import.md)       | PDF Bank Statement Import          | Import      |
| [REQ-006](REQ-006-category-learning.md) | Automatic Category Suggestion      | Import      |
| [REQ-007](REQ-007-dashboard.md)        | Dashboard & Financial Overview     | Visualization |
| [REQ-008](REQ-008-account-visibility.md) | Account Visibility Toggle          | Visualization |
| [REQ-009](REQ-009-sankey-chart.md)     | Sankey Cash Flow Diagram           | Visualization |
| [REQ-010](REQ-010-month-navigation.md) | Month Filtering & Navigation       | Navigation  |
| [REQ-011](REQ-011-batch-import.md)     | Batch Transaction Import           | Import      |
| [REQ-012](REQ-012-theme.md)            | Dark / Light Theme                 | UI/UX       |
| [REQ-013](REQ-013-2fa-totp.md)         | Two-Factor Authentication (TOTP)   | Security    |

## Document Structure

Each requirement file contains:

- **User Story** — "As a [user], I want [feature], so that [benefit]"
- **Background** — Context, business rules, and data models relevant to the feature
- **Acceptance Criteria** — One or more scenarios in Gherkin syntax (`Given / When / Then`)
- **Notes** — Implementation details, edge cases, and constraints worth knowing
