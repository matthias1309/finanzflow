/**
 * TC-001-08 — the fail-secure checks in server/auth.ts run at module top-level, guarded by
 * `NODE_ENV === "production" && DOCKER_DEPLOY !== "true"`. `vi.resetModules()` plus a fresh
 * dynamic import forces that top-level code to run again under a controlled environment, with
 * `process.exit` mocked so the test process itself survives.
 */
import { it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// Regression test — Test Gap Backlog (Session 5, TC-001-08). Investigated in Session 10: the
// intended fail-fast check never fires. `server/auth.ts` sets a hardcoded fallback
// APP_PASSWORD_HASH for ANY `NODE_ENV !== "test"` (comment: "for Docker dev mode"), before the
// production fatal-check even runs — so a production start with no APP_PASSWORD_HASH silently
// gets the known fallback hash instead of exiting. Same root cause as the "Hardcoded fallback
// secrets" follow-up already tracked in docs/MIGRATION-PLAN.md ("Out of Scope / Follow-ups").
// Documents the CURRENT behavior; once the fallback is gated to actual Docker dev mode (not just
// "not NODE_ENV=test"), this test should be rewritten to assert `process.exit(1)`.
it("known issue: production start with no APP_PASSWORD_HASH does not fail — it silently falls back to a hardcoded hash (AC-001-08)", async () => {
  process.env.NODE_ENV            = "production";
  process.env.DOCKER_DEPLOY       = "false";
  delete process.env.APP_PASSWORD_HASH;
  process.env.SESSION_SECRET      = "b8c4d2e1f7a9c5b3e8d2f1a6c9e4b7d0b8c4d2e1f7a9c5b3e8d2f1a6c9e4b7d0";
  process.env.TOTP_ENCRYPTION_KEY = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";

  const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called");
  });

  await expect(import("../../../server/auth")).resolves.toBeDefined();
  expect(exitSpy).not.toHaveBeenCalled();
  expect(process.env.APP_PASSWORD_HASH).toBeTruthy();

  exitSpy.mockRestore();
});

it("starts normally in production when all required env vars are set", async () => {
  process.env.NODE_ENV            = "production";
  process.env.DOCKER_DEPLOY       = "false";
  process.env.APP_PASSWORD_HASH   = "$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX";
  process.env.SESSION_SECRET      = "b8c4d2e1f7a9c5b3e8d2f1a6c9e4b7d0b8c4d2e1f7a9c5b3e8d2f1a6c9e4b7d0";
  process.env.TOTP_ENCRYPTION_KEY = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";

  const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called");
  });

  await expect(import("../../../server/auth")).resolves.toBeDefined();
  expect(exitSpy).not.toHaveBeenCalled();

  exitSpy.mockRestore();
});
