/**
 * TC-001-08 — the fail-secure checks in server/auth.ts run at module top-level, guarded by
 * `NODE_ENV === "production"`. `vi.resetModules()` plus a fresh dynamic import forces that
 * top-level code to run again under a controlled environment, with `process.exit` mocked so the
 * test process itself survives.
 */
import { it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

// Fixed — Session 12 (GitGuardian alert on the hardcoded fallback secrets). `server/auth.ts` no
// longer sets any fallback values itself (that is now env-defaults.ts's job, gated to
// NODE_ENV=development only), and the `DOCKER_DEPLOY !== "true"` exception was removed — AC-001-08
// never carved out a Docker exception. A production start with no APP_PASSWORD_HASH now always
// exits, regardless of DOCKER_DEPLOY.
it("production start with no APP_PASSWORD_HASH fails fast, even with DOCKER_DEPLOY=true (AC-001-08)", async () => {
  process.env.NODE_ENV            = "production";
  process.env.DOCKER_DEPLOY       = "true";
  delete process.env.APP_PASSWORD_HASH;
  process.env.SESSION_SECRET      = "f3e6d9c2b5a8f1e4d7c0b3a6f9e2d5c8b1a4f7e0d3c6b9a2f5e8d1c4b7a0f3e6";
  process.env.TOTP_ENCRYPTION_KEY = "a1c9e4f27b0d3856f9e1a4c7b2d5e8f01c4a7d0e3b6f9c2a5d8e1f4b7a0c3d6e";

  const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called");
  });

  await expect(import("../../../server/auth")).rejects.toThrow("process.exit called");
  expect(exitSpy).toHaveBeenCalledWith(1);

  exitSpy.mockRestore();
});

it("production start with a too-short SESSION_SECRET fails fast (AC-001-08)", async () => {
  process.env.NODE_ENV            = "production";
  process.env.DOCKER_DEPLOY       = "false";
  process.env.APP_PASSWORD_HASH   = "$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX";
  process.env.SESSION_SECRET      = "too-short";
  process.env.TOTP_ENCRYPTION_KEY = "a1c9e4f27b0d3856f9e1a4c7b2d5e8f01c4a7d0e3b6f9c2a5d8e1f4b7a0c3d6e";

  const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called");
  });

  await expect(import("../../../server/auth")).rejects.toThrow("process.exit called");
  expect(exitSpy).toHaveBeenCalledWith(1);

  exitSpy.mockRestore();
});

it("starts normally in production when all required env vars are set", async () => {
  process.env.NODE_ENV            = "production";
  process.env.DOCKER_DEPLOY       = "false";
  process.env.APP_PASSWORD_HASH   = "$2b$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX";
  process.env.SESSION_SECRET      = "f3e6d9c2b5a8f1e4d7c0b3a6f9e2d5c8b1a4f7e0d3c6b9a2f5e8d1c4b7a0f3e6";
  process.env.TOTP_ENCRYPTION_KEY = "a1c9e4f27b0d3856f9e1a4c7b2d5e8f01c4a7d0e3b6f9c2a5d8e1f4b7a0c3d6e";

  const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit called");
  });

  await expect(import("../../../server/auth")).resolves.toBeDefined();
  expect(exitSpy).not.toHaveBeenCalled();

  exitSpy.mockRestore();
});
