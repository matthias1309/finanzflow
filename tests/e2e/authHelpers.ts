import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { authenticator } from "otplib";

// Fixed dev-mode credential from server/env-defaults.ts (NODE_ENV=development default
// APP_PASSWORD_HASH) — documented, not a secret. The seeded default user has no TOTP
// configured, so this completes the session in one step ("step: done").
export const DEV_USERNAME = "admin";
const DEV_PASSWORD = "admin";

// Throwaway credential for users created during an E2E run against the disposable E2E DB.
const TOTP_USER_PASSWORD = "E2eTotpPass123!";

export interface TotpUser {
  readonly username: string;
  readonly password: string;
  readonly totpSecret: string;
}

// Logs in via the API so specs that only need an authenticated session (not the login
// UI itself) can skip the login form. Must run before the first page.goto/API call —
// requireAuth now rejects unauthenticated requests since APP_PASSWORD_HASH always has a
// dev default (server/env-defaults.ts).
export async function loginAsDevAdmin(page: Page): Promise<void> {
  await page.context().request.post("/api/auth/login", {
    data: { username: DEV_USERNAME, password: DEV_PASSWORD },
  });
}

// Creates a fresh user with 2FA enrolled, entirely via the API, so login specs can exercise the
// TOTP step. Uses the standalone `request` fixture, whose cookies are separate from the page's —
// the page under test stays logged out. The username is unique per call because a retried test
// (or a reused dev server) would otherwise hit "Benutzername bereits vergeben".
export async function createUserWithTotp(request: APIRequestContext): Promise<TotpUser> {
  const username = `e2e-totp-${Date.now()}`;

  await expectOk(
    request.post("/api/auth/login", { data: { username: DEV_USERNAME, password: DEV_PASSWORD } }),
  );
  await expectOk(request.post("/api/users", { data: { username, password: TOTP_USER_PASSWORD } }));
  await expectOk(
    request.post("/api/auth/login", { data: { username, password: TOTP_USER_PASSWORD } }),
  );

  const setupResponse = await expectOk(request.post("/api/auth/2fa/setup"));
  const { secret } = (await setupResponse.json()) as { secret: string };
  await expectOk(
    request.post("/api/auth/2fa/verify-setup", { data: { code: authenticator.generate(secret) } }),
  );
  await request.post("/api/auth/logout");

  return { username, password: TOTP_USER_PASSWORD, totpSecret: secret };
}

type ApiResponse = Awaited<ReturnType<APIRequestContext["get"]>>;

async function expectOk(pendingResponse: Promise<ApiResponse>): Promise<ApiResponse> {
  const response = await pendingResponse;
  expect(response.ok(), `${response.url()} → ${response.status()}`).toBe(true);
  return response;
}
