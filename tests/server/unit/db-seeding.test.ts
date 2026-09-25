/**
 * Tests the ENV-Sync admin seeding in server/db.ts directly (TC-015-15). The seeding logic runs
 * at module top-level on every `db.ts` import, so — unlike the API tests — this needs a real
 * temp-file DB (not `:memory:`) plus `vi.resetModules()` to force two separate "server starts"
 * against the same database with different APP_PASSWORD_HASH values.
 *
 * APP_PASSWORD_HASH only seeds the *initial* password. Once the user exists, its password hash
 * must survive a restart even if APP_PASSWORD_HASH changed in the meantime — otherwise a
 * password set via the UI (AC-015-09/AC-015-10) is silently reverted on the next restart.
 */
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import bcrypt from "bcryptjs";

let tempDir: string;
let dbPath: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "finanzflow-db-seed-"));
  dbPath  = join(tempDir, "test.db");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// TC-015-15
it("preserves an existing seed user's password hash on the next start", async () => {
  process.env.DB_PATH          = dbPath;
  process.env.APP_USER         = "admin";
  const firstHash = bcrypt.hashSync("FirstPass1!", 10);
  process.env.APP_PASSWORD_HASH = firstHash;

  await import("../../../server/db");

  process.env.APP_PASSWORD_HASH = bcrypt.hashSync("SecondPass2!", 10);

  vi.resetModules();
  const { db } = await import("../../../server/db");
  const { users } = await import("../../../shared/schema");
  const { eq } = await import("drizzle-orm");

  const admin = db.select().from(users).where(eq(users.username, "admin")).get();
  expect(admin).toBeDefined();
  expect(admin!.passwordHash).toBe(firstHash);
  expect(admin!.isAdmin).toBe(1);
});
