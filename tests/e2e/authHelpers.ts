import type { Page } from "@playwright/test";

// Fixed dev-mode credential from server/env-defaults.ts (NODE_ENV=development default
// APP_PASSWORD_HASH) — documented, not a secret. The seeded default user has no TOTP
// configured, so this completes the session in one step ("step: done").
const DEV_USERNAME = "admin";
const DEV_PASSWORD = "admin";

// Logs in via the API so specs that only need an authenticated session (not the login
// UI itself) can skip the login form. Must run before the first page.goto/API call —
// requireAuth now rejects unauthenticated requests since APP_PASSWORD_HASH always has a
// dev default (server/env-defaults.ts).
export async function loginAsDevAdmin(page: Page): Promise<void> {
  await page.context().request.post("/api/auth/login", {
    data: { username: DEV_USERNAME, password: DEV_PASSWORD },
  });
}
