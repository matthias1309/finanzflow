/**
 * TC-001-10 — server/env-defaults.ts is imported first by server/index.ts, before NODE_ENV is
 * necessarily set, so it must never hand out secret fallback values (APP_PASSWORD_HASH,
 * SESSION_SECRET, TOTP_ENCRYPTION_KEY) outside genuine local development. Regression coverage for
 * the GitGuardian-flagged hardcoded secrets (Session 12) — see AC-001-08 / ARCH-001.
 */
import { it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

it("does not set secret fallbacks in production", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.APP_PASSWORD_HASH;
  delete process.env.SESSION_SECRET;
  delete process.env.TOTP_ENCRYPTION_KEY;

  await import("../../../server/env-defaults");

  expect(process.env.APP_PASSWORD_HASH).toBeUndefined();
  expect(process.env.SESSION_SECRET).toBeUndefined();
  expect(process.env.TOTP_ENCRYPTION_KEY).toBeUndefined();
});

it("does not set secret fallbacks in test", async () => {
  process.env.NODE_ENV = "test";
  delete process.env.APP_PASSWORD_HASH;
  delete process.env.SESSION_SECRET;
  delete process.env.TOTP_ENCRYPTION_KEY;

  await import("../../../server/env-defaults");

  expect(process.env.APP_PASSWORD_HASH).toBeUndefined();
  expect(process.env.SESSION_SECRET).toBeUndefined();
  expect(process.env.TOTP_ENCRYPTION_KEY).toBeUndefined();
});

it("sets usable, non-fixed secret fallbacks in development", async () => {
  process.env.NODE_ENV = "development";
  delete process.env.APP_PASSWORD_HASH;
  delete process.env.SESSION_SECRET;
  delete process.env.TOTP_ENCRYPTION_KEY;

  await import("../../../server/env-defaults");

  expect(process.env.APP_PASSWORD_HASH).toBeTruthy();
  expect(process.env.SESSION_SECRET?.length).toBeGreaterThanOrEqual(32);
  expect(process.env.TOTP_ENCRYPTION_KEY).toHaveLength(64);
});

it("generates a different SESSION_SECRET on every fresh process start", async () => {
  process.env.NODE_ENV = "development";
  delete process.env.SESSION_SECRET;
  await import("../../../server/env-defaults");
  const first = process.env.SESSION_SECRET;

  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, NODE_ENV: "development" };
  delete process.env.SESSION_SECRET;
  await import("../../../server/env-defaults");
  const second = process.env.SESSION_SECRET;

  expect(first).not.toEqual(second);
});

it("never overrides explicitly configured secrets", async () => {
  process.env.NODE_ENV            = "development";
  process.env.APP_PASSWORD_HASH   = "$2b$10$explicitHashExplicitHashExplicitHashExplicitHa";
  process.env.SESSION_SECRET      = "explicit-session-secret-explicit-session-secret";
  process.env.TOTP_ENCRYPTION_KEY = "1111111111111111111111111111111111111111111111111111111111111a";

  await import("../../../server/env-defaults");

  expect(process.env.APP_PASSWORD_HASH).toBe("$2b$10$explicitHashExplicitHashExplicitHashExplicitHa");
  expect(process.env.SESSION_SECRET).toBe("explicit-session-secret-explicit-session-secret");
});
