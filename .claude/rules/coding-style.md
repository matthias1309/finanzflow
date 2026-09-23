# Coding Style

Project-specific architecture rules (shared schema, storage façade, recipes for new endpoints /
parsers / DB fields) live in `architecture.md`. This file covers general code style.

## Core Principles

- **KISS (Keep It Simple, Stupid):** Choose the simplest solution. Avoid over-engineering.
- **DRY (Don't Repeat Yourself):** Abstract from the third repetition on (Rule of Three).
- **YAGNI (You Ain't Gonna Need It):** Do not implement features speculatively.
- **Boy Scout Rule:** Leave the code cleaner than you found it.

---

## Naming

- Variables and functions: `camelCase`
- Classes, interfaces, types, React components: `PascalCase`
- Global immutable constants: `UPPER_SNAKE_CASE`
- Files: follow the existing directory convention (`PascalCase.tsx` for pages/components,
  `camelCase.ts` for server modules, `kebab-case.tsx` for shadcn/ui components)
- Boolean variables: prefix with `is`, `has`, `can`, `should`
- Names must express intent: `elapsedTimeInDays` not `d`; no bare `data`, `info`, `temp`, `value`
- No abbreviations — allowed exceptions: `id`, `db`, `req`, `res`, `err`, `ctx`, `url`, `i`
- Stay consistent with project-wide vocabulary (e.g. always `getAccounts`, never mix with
  `fetchAccounts` or `retrieveAccounts` in the storage layer)
- Use terms from the problem domain (Domain-Driven Naming)

## Functions & Methods

- One responsibility per function (SRP)
- Max ~30 lines; extract helpers if longer
- Max 3 parameters; use a `readonly` options object for more
- No flag parameters — `doSomething(true)` is forbidden (what is `true`?); split the function or
  pass a named option
- Prefer pure functions over side effects — no hidden state mutations
- Name functions after what they return, not what they do internally
- No magic numbers — assign to a named constant first
- **Command-Query Separation:** a function either changes state OR returns a value, never both

```typescript
// ❌ Bad
function handle(user: User, isAdmin: boolean, sendMail: boolean) { ... }

// ✅ Good
interface HandleUserOptions {
  readonly user: User;
  readonly role: UserRole;
  readonly notifications: NotificationConfig;
}
function handleUser(options: HandleUserOptions): void { ... }
```

## Imports

- Group in order: Node built-ins → third-party → internal (`@shared/…`, `@/…`, relative)
- Blank line between groups
- No wildcard imports (`import *`) except where a library requires it (e.g. `d3`)
- Prefer named exports over default exports (React page components are the existing exception)

## Code Structure

- Flat is better than nested: return early instead of deep `if/else`
- Explicit over clever: readable code beats terse code
- One level of abstraction per function
- No commented-out code — delete it, git has history

## Comments & Documentation

- Write self-documenting code — names and structure should make comments about *what* unnecessary
- Comments explain *why*, not *how*: use them for non-obvious constraints, design decisions, or workarounds
- Implementation code carries no REQ IDs in comments (traceability is via commit messages, see `v-model.md`)

## Error Handling

- Use exceptions, not error codes or `boolean` return values
- Fail fast: validate preconditions early and throw immediately
- Custom error classes for domain errors (see `server/paperlessClient.ts` for the pattern):

  ```typescript
  class UserNotFoundError extends Error {
    constructor(userId: string) {
      super(`User not found: ${userId}`);
      this.name = "UserNotFoundError";
    }
  }
  ```

- Type every caught error — no `catch (e: any)`; narrow `unknown` with `instanceof`
- No silent failures — an empty `catch` is forbidden
- Avoid `null` returns for collections — return an empty array instead

## Types (TypeScript)

- **Never use `any`** — use `unknown` and narrow it (enforced by ESLint `no-explicit-any` = error)
- Explicit return types on all non-trivial functions
- `interface` for object shapes, `type` for unions and aliases
- `readonly` wherever possible on parameters and properties
- Mark optional fields explicitly with `?`
- Avoid non-null assertions (`!`) without a comment explaining why
- Strict mode stays on — never weaken `tsconfig.json`, never use `@ts-ignore`

## Formatting

- Prettier config is authoritative (`.prettierrc.json`): 2 spaces, double quotes, semicolons,
  trailing commas, max line length 100
- The existing tree is not yet fully Prettier-formatted — format the lines you touch, do not
  reformat whole unrelated files in a feature PR
