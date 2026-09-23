/**
 * Auth-Tests: Login-Flow, TOTP-Verifikation, Session-Enforcement, 2FA-Setup, Recovery-Codes.
 *
 * Warum dynamischer Import statt statischem `import { createApp }`:
 * setup.ts setzt APP_PASSWORD_HASH="" bevor Module geladen werden.
 * auth.ts liest PASSWORD_HASH einmalig beim Modul-Load (const auf Top-Level).
 * Durch dynamic import in beforeAll können wir APP_PASSWORD_HASH setzen
 * BEVOR auth.ts zum ersten Mal evaluiert wird → Auth wird erzwungen.
 *
 * Test-Reihenfolge ist bewusst: Erst TOTP-Setup, dann TOTP-Login-Tests.
 * Die DB ist :memory: pro Testdatei — Zustand wird zwischen describes geteilt.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { authenticator } from "otplib";
import type { Express } from "express";

const TEST_USER     = "admin";
const TEST_PASSWORD = "TestPass123!";

let app: Express;

// Session mit abgeschlossenem Passwort-Login (ohne TOTP, da noch nicht konfiguriert)
let passwordSession: request.SuperAgentTest;

// Einmal aktiviertes TOTP-Secret + die dabei ausgegebenen Recovery-Codes für
// passwordSession. requireStepUp verlangt nach der Erstaktivierung eine frische
// TOTP-Verifikation für jede weitere 2FA-Management-Operation — deshalb wird
// hier NICHT erneut /2fa/setup aufgerufen, sondern dasselbe Secret überall
// wiederverwendet (Erstaktivierung selbst ist stepUp-frei, da 2FA zu dem
// Zeitpunkt noch nicht konfiguriert ist).
let activeTotpSecret: string;
let initialRecoveryCodes: string[];

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const bcrypt = await import("bcryptjs");

  process.env.APP_USER             = TEST_USER;
  process.env.APP_PASSWORD_HASH    = bcrypt.default.hashSync(TEST_PASSWORD, 10);
  process.env.SESSION_SECRET       = "test-session-secret-at-least-32-chars!!";
  process.env.TOTP_ENCRYPTION_KEY  = "ab".repeat(32); // 64 hex chars = 32 bytes
  process.env.APP_ORIGIN           = "http://localhost:3000";

  const { createApp } = await import("../../../server/createApp");
  ({ app } = createApp());

  // Vor TOTP-Setup: Password-Login liefert step=done → Session ist authenticated
  passwordSession = request.agent(app);
  const loginRes = await passwordSession
    .post("/api/auth/login")
    .send({ username: TEST_USER, password: TEST_PASSWORD });
  expect(loginRes.body.step).toBe("done");
});

// ─── Hilfsfunktion: TOTP-Code für ein bestimmtes Zeitfenster ─────────────────
// TOTP-Codes ändern sich nur alle 30s. Mehrere Codes für dasselbe Secret
// innerhalb eines Testlaufs (Millisekunden auseinander) wären sonst identisch
// und würden an der Replay-Protection (totp_last_used_token) scheitern.
// windowOffset bleibt in [-1, 1] — der Server toleriert genau ±1 Schritt Drift
// (otplib-Default, siehe server/totp.ts).

const TOTP_STEP_MS = 30_000;

function totpCodeAt(secret: string, windowOffset: -1 | 0 | 1 = 0): string {
  authenticator.options = { epoch: Date.now() + windowOffset * TOTP_STEP_MS };
  return authenticator.generate(secret);
}

// ─── Hilfsfunktion: vollständiger Login (Passwort + TOTP) ────────────────────

async function loginWithTotp(totpSecret: string, windowOffset: -1 | 0 | 1 = 0): Promise<request.SuperAgentTest> {
  const sessionAgent = request.agent(app);
  await sessionAgent.post("/api/auth/login").send({ username: TEST_USER, password: TEST_PASSWORD });
  const code = totpCodeAt(totpSecret, windowOffset);
  await sessionAgent.post("/api/auth/totp").send({ code });
  return sessionAgent;
}

// ─── Hilfsfunktion: 2FA zurücksetzen und mit neuem Secret neu aktivieren ─────
// Liefert ein frisches, bisher nirgends verwendetes Secret — unabhängig von
// activeTotpSecret und dessen bereits verbrauchtem Replay-Schutz-Zustand.

async function resetAndReactivate2fa(): Promise<string> {
  const usersRes = await passwordSession.get("/api/users");
  const userId = usersRes.body.find((u: { username: string }) => u.username === TEST_USER)?.id;
  await passwordSession.post(`/api/users/${userId}/2fa-reset`);

  const setupRes = await passwordSession.post("/api/auth/2fa/setup");
  const { secret } = setupRes.body as { secret: string };
  await passwordSession.post("/api/auth/2fa/verify-setup").send({ code: totpCodeAt(secret) });
  return secret;
}

// ─── Session Enforcement ─────────────────────────────────────────────────────

describe("Session enforcement", () => {
  // TC-001-06 (partial — "never logged in", not "session expired")
  it("rejects unauthenticated requests to protected routes with 401", async () => {
    const res = await request(app).get("/api/accounts");
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  // TC-001-02
  it("returns 401 when password is wrong", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: TEST_USER, password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when body is missing username", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ password: TEST_PASSWORD });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is missing password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: TEST_USER });
    expect(res.status).toBe(400);
  });

  // TC-013-01, TC-015-16
  it("returns 200 and step=done when credentials are correct and 2FA is not configured", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/api/auth/login")
      .send({ username: TEST_USER, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.step).toBe("done");
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  // TC-001-07 (partial)
  it("returns 200", async () => {
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
  });
});

// ─── GET /api/auth/2fa/status (public) ───────────────────────────────────────

describe("GET /api/auth/2fa/status", () => {
  it("returns configured=false when 2FA has not been set up", async () => {
    const res = await request(app).get("/api/auth/2fa/status");
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
  });
});

// ─── 2FA Setup (benötigt eingeloggte Session) ─────────────────────────────────

describe("POST /api/auth/2fa/setup", () => {
  // TC-013-02
  it("returns a secret and an otpAuthUrl", async () => {
    const res = await passwordSession.post("/api/auth/2fa/setup");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("secret");
    expect(res.body).toHaveProperty("otpAuthUrl");
    expect(typeof res.body.secret).toBe("string");
    expect(res.body.otpAuthUrl).toMatch(/^otpauth:\/\/totp\//);
  });

  // TC-013-04
  it("returns 400 when an invalid code is submitted to verify-setup", async () => {
    await passwordSession.post("/api/auth/2fa/setup");

    const res = await passwordSession
      .post("/api/auth/2fa/verify-setup")
      .send({ code: "000000" });
    expect(res.status).toBe(400);
  });

  // TC-013-03
  it("activates 2FA and returns 8 recovery codes when a valid code is submitted", async () => {
    const setupRes = await passwordSession.post("/api/auth/2fa/setup");
    expect(setupRes.status).toBe(200);
    const { secret } = setupRes.body as { secret: string };
    activeTotpSecret = secret;

    const code = authenticator.generate(secret);
    const verifyRes = await passwordSession
      .post("/api/auth/2fa/verify-setup")
      .send({ code });

    expect(verifyRes.status).toBe(200);
    expect(Array.isArray(verifyRes.body.recoveryCodes)).toBe(true);
    expect(verifyRes.body.recoveryCodes).toHaveLength(8);
    verifyRes.body.recoveryCodes.forEach((c: unknown) => {
      expect(typeof c).toBe("string");
      expect((c as string).length).toBeGreaterThan(0);
    });
    initialRecoveryCodes = verifyRes.body.recoveryCodes;
  });
});

// ─── Login returns step=totp (nach TOTP-Setup) ───────────────────────────────

describe("POST /api/auth/login (after 2FA is configured)", () => {
  // TC-001-01 (partial — password step)
  it("returns 200 and step=totp when credentials are correct", async () => {
    const agent = request.agent(app);
    const res = await agent
      .post("/api/auth/login")
      .send({ username: TEST_USER, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.step).toBe("totp");
  });
});

// ─── GET /api/auth/2fa/status after setup ────────────────────────────────────

describe("GET /api/auth/2fa/status after setup", () => {
  it("returns configured=true and recoveryCodesRemaining=8 after setup", async () => {
    const res = await request(app).get("/api/auth/2fa/status");
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(true);
    expect(res.body.recoveryCodesRemaining).toBe(8);
  });
});

// ─── POST /api/auth/totp ──────────────────────────────────────────────────────

describe("POST /api/auth/totp", () => {
  it("returns 401 when called without a pending login session", async () => {
    const res = await request(app)
      .post("/api/auth/totp")
      .send({ code: "000000" });
    expect(res.status).toBe(401);
  });

  // TC-001-03
  it("returns 401 when TOTP code is wrong", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ username: TEST_USER, password: TEST_PASSWORD });
    const res = await agent.post("/api/auth/totp").send({ code: "000000" });
    expect(res.status).toBe(401);
  });
});

// ─── Recovery Codes ───────────────────────────────────────────────────────────

describe("Recovery codes", () => {
  let recoveryCode: string;

  beforeAll(() => {
    // Nutzt die beim Erstaktivieren (siehe "activates 2FA...") ausgegebenen
    // Codes — ein erneuter /2fa/setup-Aufruf würde an requireStepUp scheitern.
    recoveryCode = initialRecoveryCodes[0];
  });

  // TC-001-04
  it("accepts a valid recovery code in place of TOTP", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ username: TEST_USER, password: TEST_PASSWORD });
    const res = await agent.post("/api/auth/totp").send({ code: recoveryCode });
    expect(res.status).toBe(200);
  });

  // TC-001-04 (single-use)
  it("rejects the same recovery code a second time (single-use)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ username: TEST_USER, password: TEST_PASSWORD });
    const res = await agent.post("/api/auth/totp").send({ code: recoveryCode });
    expect(res.status).toBe(401);
  });

  it("decrements recoveryCodesRemaining after a code is used", async () => {
    const res = await request(app).get("/api/auth/2fa/status");
    expect(res.body.recoveryCodesRemaining).toBe(7);
  });
});

// ─── Recovery Code Regeneration ───────────────────────────────────────────────

describe("POST /api/auth/2fa/regenerate-recovery", () => {
  // requireStepUp verlangt eine frische TOTP-Verifikation (<5 Min), sobald 2FA
  // konfiguriert ist — passwordSession hat seit dem 2FA-Setup keine mehr gemacht.
  beforeAll(async () => {
    const code = authenticator.generate(activeTotpSecret);
    const res = await passwordSession.post("/api/auth/step-up").send({ code });
    expect(res.status).toBe(200);
  });

  // TC-013-06
  it("returns 8 new recovery codes", async () => {
    const res = await passwordSession.post("/api/auth/2fa/regenerate-recovery");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.recoveryCodes)).toBe(true);
    expect(res.body.recoveryCodes).toHaveLength(8);
  });

  // TC-013-06 (invalidation)
  it("invalidates old recovery codes after regeneration", async () => {
    const firstRegen = await passwordSession.post("/api/auth/2fa/regenerate-recovery");
    const oldCode = firstRegen.body.recoveryCodes[0];

    // Regenerate again — old codes should now be invalid
    await passwordSession.post("/api/auth/2fa/regenerate-recovery");

    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ username: TEST_USER, password: TEST_PASSWORD });
    const res = await agent.post("/api/auth/totp").send({ code: oldCode });
    expect(res.status).toBe(401);
  });
});

// ─── Full Login Flow Integration ──────────────────────────────────────────────

describe("Full login flow (password → TOTP → authenticated session)", () => {
  // Eigenes, frisches Secret statt activeTotpSecret weiterzuverwenden: dessen
  // aktueller Zeitfenster-Code wurde bereits vom Step-up in "regenerate-recovery"
  // verbraucht (Replay-Protection). Die drei Tests unten, die selbst einen
  // gültigen Code brauchen, bekommen zusätzlich je ein eigenes Zeitfenster
  // (-1/0/+1), damit sie sich nicht gegenseitig kollidieren.
  let totpSecret: string;

  beforeAll(async () => {
    totpSecret = await resetAndReactivate2fa();
  });

  // TC-001-01
  it("grants access to protected routes after completing both steps", async () => {
    const agent = await loginWithTotp(totpSecret, -1);
    const res = await agent.get("/api/accounts");
    expect(res.status).toBe(200);
  });

  // TC-001-07
  it("after logout, the same session cookie no longer grants access", async () => {
    const agent = await loginWithTotp(totpSecret, 0);
    await agent.post("/api/auth/logout");
    const res = await agent.get("/api/accounts");
    expect(res.status).toBe(401);
  });

  it("rejects a TOTP code that was already used in the same 30-second window (replay protection)", async () => {
    const agent1 = request.agent(app);
    await agent1.post("/api/auth/login").send({ username: TEST_USER, password: TEST_PASSWORD });
    const code = totpCodeAt(totpSecret, 1);
    await agent1.post("/api/auth/totp").send({ code });

    // Same code used again in a fresh login
    const agent2 = request.agent(app);
    await agent2.post("/api/auth/login").send({ username: TEST_USER, password: TEST_PASSWORD });
    const res = await agent2.post("/api/auth/totp").send({ code });
    expect(res.status).toBe(401);
  });

  it("rejects requests with pendingTotp session (password done, TOTP not yet verified)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ username: TEST_USER, password: TEST_PASSWORD });
    const res = await agent.get("/api/accounts");
    expect(res.status).toBe(401);
  });
});
