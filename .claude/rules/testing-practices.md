# Testing Practices

## Philosophy

- Test behavior, not implementation details
- Tests are documentation — write them for the next developer
- A failing test should tell you exactly what broke and why
- Prefer fewer, meaningful tests over many shallow ones
- Every new function needs coverage — at least the happy path plus one error case

## FIRST Principles

Tests must be:
- **Fast** — run in milliseconds, never block on real network I/O
- **Independent** — no test depends on another; any order must work
- **Repeatable** — same result every time, in any environment
- **Self-Validating** — pass or fail with no manual inspection needed
- **Timely** — written before the implementation (TDD, see `v-model.md`)

## Test Layers

Two layers, both fully isolated — no shared database, no running server for unit/API tests.

| What | Layer | Location |
|---|---|---|
| Pure helper functions (parsers, clients with mocked `fetch`) | Vitest unit | `tests/server/unit/*.test.ts` |
| REST endpoints (request → response) | Vitest + Supertest API | `tests/server/api/*.test.ts` |
| Critical user journeys in the browser | Playwright E2E | `tests/e2e/*.spec.ts` |

Tests live in the `tests/` tree, **not** next to the source files. No duplication between
layers: what an API test covers, an E2E test does not repeat.

## Test Structure

Use Arrange-Act-Assert (AAA). **No logic in tests** — only setup, execution, assertion. No `if`,
no `for`, no helper functions with branches.

```typescript
// TC-002-01
it("should create an account when the payload is valid", async () => {
  // Arrange
  const payload = { name: "Girokonto", bank: "ING", type: "checking", color: "#01696f", iban: null };

  // Act
  const res = await agent.post("/api/accounts").send(payload);

  // Assert
  expect(res.status).toBe(201);
});
```

## Naming

- Test files: `*.test.ts` (Vitest) and `*.spec.ts` (Playwright)
- Describe blocks: the unit or endpoint under test
- Test cases describe expected behavior, not implementation:
  `it("should return 404 when the account does not exist")`
- Tests that verify an acceptance criterion carry the TC ID as a comment: `// TC-XXX-YY`
- A test that pins a **confirmed, not yet fixed bug** is named `it("known issue: …")`, asserts the
  current behavior, and its comment names the TC ID, the violated AC, and the ARCH Open Question.
  The fix PR flips the assertion and removes the prefix.

## Vitest Isolation

`vitest.config.ts` sets `pool: "forks"` — every test file runs in its own Node.js process.
`tests/server/setup.ts` sets **before** any module import:

```typescript
process.env.DB_PATH = ":memory:"; // fresh SQLite DB per test file
process.env.NODE_ENV = "test";    // auth + CSRF disabled automatically
```

`DB_PATH` must be set in `setup.ts`, not inside a test — `db.ts` is evaluated on first import.

The DB seed (default categories) runs on every process start. Tests may build on it but must be
robust against additional rows (never assert an exact total count).

Test files that need the real login flow (`auth.test.ts`, `users.test.ts`) set a real
`APP_PASSWORD_HASH`, which enables auth for the whole file — call protected endpoints through a
logged-in agent there.

## API Tests

```typescript
import request from "supertest";
import { createApp } from "../../../server/createApp";

const { app } = createApp(); // no listen() — Supertest binds itself
const agent = request(app);
```

Call `createApp()` once per test file (not in `beforeEach` — that would create a new app
instance with a new DB). Create dependent records in `beforeEach` via the API.

## Mocking

- Mock at the boundary (module or network boundary), not inside the implementation
  — e.g. `vi.mock` of `server/paperlessClient.ts` in API tests, mocked global `fetch` in its unit tests
- Verify mock interactions only when the call itself is the behavior being tested
- Unit tests do no real network I/O; API tests may use the in-memory SQLite DB

## E2E Tests (Playwright)

- **Separate server** on port 3001 with its own database (`DB_PATH=/tmp/finanzflow_e2e.db`);
  `tests/e2e/globalSetup.ts` deletes it before every run. Never use port 3000 (dev server).
- Create test data via the API (`page.context().request.post(...)`), not the UI, when it is only setup
- **`data-testid` on every interactive element** an E2E test uses. Naming scheme:
  - `button-add-{resource}` — opens the create dialog
  - `button-save-{resource}` — saves a form
  - `button-edit-{resource}-{id}` — opens the edit dialog for a specific entry
  - `button-delete-{resource}-{id}` — deletes a specific entry
  - `input-{field}` — input field
  - `select-{field}` — select field
  - `{resource}-card-{id}` / `{resource}-item-{id}` — list element
- Add missing `data-testid` attributes to the UI before writing the E2E test
- E2E tests are not part of CI yet — run them locally with `npm run test:e2e`

## Commands

```bash
npm test                 # Vitest run (all tests/server/ tests)
npm run test:watch       # Vitest watch mode
npm run test:e2e         # Playwright (starts its own dev server on port 3001)
npm run test:e2e:ui      # Playwright UI mode
npx playwright install   # install browsers (once)
```

## Coverage

- Aim for 80%+ line coverage on server business logic
- 100% coverage does not mean 100% correctness — test edge cases explicitly
- Don't write tests purely to hit a coverage number

## What Not to Test

- Drizzle ORM internals — external library
- shadcn/ui components — UI library, not our code
- React Query cache behavior — API tests test the API, E2E tests test the result in the browser
- Trivial getters/setters with no logic
