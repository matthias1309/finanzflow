/**
 * API-Tests für User-Management (REQ-015).
 *
 * APP_PASSWORD_HASH wird hier bewusst auf einen echten bcrypt-Hash gesetzt (wie
 * in auth.test.ts) — die "Seeding"-Tests am Ende prüfen den echten ENV-Sync-
 * Login-Flow. Dadurch ist Auth für die GANZE Datei aktiv (requireAuth prüft nur
 * global, ob APP_PASSWORD_HASH gesetzt ist — kein Umschalten pro Testblock
 * möglich). Alle admin-geschützten Endpunkte laufen deshalb über eine echte,
 * eingeloggte adminSession statt über ein unauthentifiziertes request(app).
 *
 * Dynamic import nach env-Setup wie in auth.test.ts — db.ts und createApp.ts
 * lesen APP_USER/APP_PASSWORD_HASH beim Modul-Load für den Seed-User.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { PublicUser } from "../../../shared/schema";

const SEED_USER = "admin";
const SEED_PASS = "AdminPass123!";

let app: Express;
let adminSession: request.SuperAgentTest;
let adminId: number;

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const bcrypt = await import("bcryptjs");

  process.env.APP_USER = SEED_USER;
  process.env.APP_PASSWORD_HASH = bcrypt.default.hashSync(SEED_PASS, 10);
  process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars!!";
  process.env.TOTP_ENCRYPTION_KEY = "ab".repeat(32);
  process.env.APP_ORIGIN = "http://localhost:3000";

  const { createApp } = await import("../../../server/createApp");
  ({ app } = createApp());

  // TOTP ist für den frisch geseedeten Admin noch nicht konfiguriert → step=done
  adminSession = request.agent(app);
  const loginRes = await adminSession
    .post("/api/auth/login")
    .send({ username: SEED_USER, password: SEED_PASS });
  expect(loginRes.body.step).toBe("done");

  const res = await adminSession.get("/api/users");
  adminId = (res.body as PublicUser[]).find((u) => u.username === SEED_USER)?.id ?? 0;
});

// ─── GET /api/users ───────────────────────────────────────────────────────────

describe("GET /api/users", () => {
  // TC-015-01
  it("returns 200 with an array containing the seeded admin", async () => {
    const res = await adminSession.get("/api/users");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as PublicUser[]).some((u) => u.username === SEED_USER)).toBe(true);
  });

  it("seeded admin has isAdmin=1", async () => {
    const res = await adminSession.get("/api/users");
    const admin = (res.body as PublicUser[]).find((u) => u.username === SEED_USER);
    // users.is_admin ist 0/1 (SQLite-Integer), kein Boolean — siehe shared/schema.ts
    expect(admin?.isAdmin).toBe(1);
  });

  it("does not include passwordHash or totpSecret in response", async () => {
    const res = await adminSession.get("/api/users");
    (res.body as PublicUser[]).forEach((u) => {
      expect(u).not.toHaveProperty("passwordHash");
      expect(u).not.toHaveProperty("totpSecret");
    });
  });
});

// ─── POST /api/users ──────────────────────────────────────────────────────────

describe("POST /api/users", () => {
  // TC-015-02
  it("creates a new user and returns 201", async () => {
    const res = await adminSession
      .post("/api/users")
      .send({ username: "lisa", password: "Password123!" });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe("lisa");
    expect(res.body.isAdmin).toBe(0);
    expect(res.body.totpEnabled).toBe(0);
    expect(res.body).toHaveProperty("id");
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  // TC-015-03
  it("returns 409 when username is already taken", async () => {
    await adminSession.post("/api/users").send({ username: "doppelt", password: "Password123!" });
    const res = await adminSession
      .post("/api/users")
      .send({ username: "doppelt", password: "Password123!" });
    expect(res.status).toBe(409);
  });

  it("returns 400 when username is missing", async () => {
    const res = await adminSession.post("/api/users").send({ password: "Password123!" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const res = await adminSession.post("/api/users").send({ username: "nopw" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const res = await adminSession
      .post("/api/users")
      .send({ username: "kurzpw", password: "1234567" });
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/users/:id ─────────────────────────────────────────────────────

describe("PATCH /api/users/:id", () => {
  let testUserId: number;

  beforeAll(async () => {
    const res = await adminSession
      .post("/api/users")
      .send({ username: "patchuser", password: "Password123!" });
    testUserId = res.body.id;
  });

  // TC-015-04
  it("grants admin rights to a user and returns 200", async () => {
    const res = await adminSession.patch(`/api/users/${testUserId}`).send({ isAdmin: true });
    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(1);
  });

  // TC-015-05
  it("revokes admin rights when another admin exists", async () => {
    const res = await adminSession.patch(`/api/users/${testUserId}`).send({ isAdmin: false });
    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(0);
  });

  // TC-015-06
  it("returns 409 when trying to demote the last admin", async () => {
    const res = await adminSession.patch(`/api/users/${adminId}`).send({ isAdmin: false });
    expect(res.status).toBe(409);
  });

  it("returns 404 for an unknown user id", async () => {
    const res = await adminSession.patch("/api/users/99999").send({ isAdmin: true });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────

describe("DELETE /api/users/:id", () => {
  // TC-015-07 (partial — session invalidation not covered, see TEST-015)
  it("deletes a non-admin user and returns 204", async () => {
    const created = await adminSession
      .post("/api/users")
      .send({ username: "todelete", password: "Password123!" });
    const res = await adminSession.delete(`/api/users/${created.body.id}`);
    expect(res.status).toBe(204);

    const list = await adminSession.get("/api/users");
    expect((list.body as PublicUser[]).some((u) => u.username === "todelete")).toBe(false);
  });

  // TC-015-08
  it("returns 409 when trying to delete the last admin", async () => {
    const res = await adminSession.delete(`/api/users/${adminId}`);
    expect(res.status).toBe(409);
  });

  it("returns 404 for an unknown user id", async () => {
    const res = await adminSession.delete("/api/users/99999");
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/users/:id/password ───────────────────────────────────────────

describe("PATCH /api/users/:id/password", () => {
  let targetId: number;

  beforeAll(async () => {
    const res = await adminSession
      .post("/api/users")
      .send({ username: "pwuser", password: "OldPass123!" });
    targetId = res.body.id;
  });

  // TC-015-09 (partial — session invalidation not covered, see TEST-015)
  it("sets a new password without oldPassword (admin flow) and returns 200", async () => {
    const res = await adminSession
      .patch(`/api/users/${targetId}/password`)
      .send({ newPassword: "NewPass456!" });
    expect(res.status).toBe(200);
  });

  it("returns 400 when newPassword is too short", async () => {
    const res = await adminSession
      .patch(`/api/users/${targetId}/password`)
      .send({ newPassword: "short" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when newPassword is missing", async () => {
    const res = await adminSession.patch(`/api/users/${targetId}/password`).send({});
    expect(res.status).toBe(400);
  });

  // TC-015-11
  it("returns 401 when oldPassword is provided but wrong", async () => {
    const res = await adminSession
      .patch(`/api/users/${targetId}/password`)
      .send({ oldPassword: "WrongOld!", newPassword: "NewPass789!" });
    expect(res.status).toBe(401);
  });

  // TC-015-10 (partial — "current session preserved" not separately re-asserted)
  it("changes password when oldPassword is correct", async () => {
    await adminSession
      .patch(`/api/users/${targetId}/password`)
      .send({ newPassword: "KnownPass1!" });

    const res = await adminSession
      .patch(`/api/users/${targetId}/password`)
      .send({ oldPassword: "KnownPass1!", newPassword: "FinalPass2!" });
    expect(res.status).toBe(200);
  });

  it("returns 404 for an unknown user id", async () => {
    const res = await adminSession
      .patch("/api/users/99999/password")
      .send({ newPassword: "NewPass456!" });
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/users/:id/2fa-reset ───────────────────────────────────────────

describe("POST /api/users/:id/2fa-reset", () => {
  // TC-015-13 (partial — target user never had TOTP configured in this test, session invalidation not covered, see TEST-015)
  it("returns 200 and resets TOTP state for a user", async () => {
    const created = await adminSession
      .post("/api/users")
      .send({ username: "totpuser", password: "Password123!" });
    const res = await adminSession.post(`/api/users/${created.body.id}/2fa-reset`);
    expect(res.status).toBe(200);

    const list = await adminSession.get("/api/users");
    const user = (list.body as PublicUser[]).find((u) => u.id === created.body.id);
    expect(user?.totpEnabled).toBe(0);
  });

  it("returns 404 for an unknown user id", async () => {
    const res = await adminSession.post("/api/users/99999/2fa-reset");
    expect(res.status).toBe(404);
  });
});

// ─── Zugriffskontrolle für Nicht-Admins ──────────────────────────────────────

describe("Access control for non-admin users", () => {
  let lisaSession: request.SuperAgentTest;

  beforeAll(async () => {
    await adminSession.post("/api/users").send({ username: "lisa2", password: "Password123!" });
    lisaSession = request.agent(app);
    const loginRes = await lisaSession
      .post("/api/auth/login")
      .send({ username: "lisa2", password: "Password123!" });
    expect(loginRes.body.step).toBe("done");
  });

  // TC-015-12
  it("returns 403 for a non-admin user on GET /api/users", async () => {
    const res = await lisaSession.get("/api/users");
    expect(res.status).toBe(403);
  });

  it("returns 403 for a non-admin user on POST /api/users", async () => {
    const res = await lisaSession.post("/api/users").send({ username: "x", password: "Password123!" });
    expect(res.status).toBe(403);
  });

  it("returns 403 for a non-admin user on DELETE /api/users/:id", async () => {
    const res = await lisaSession.delete(`/api/users/${adminId}`);
    expect(res.status).toBe(403);
  });

  // Regression test — Test Gap Backlog (Session 5): PATCH /api/users/:id/password has no
  // `requireAdmin` (by design, so users can change their own password) but also never checks
  // that the caller owns `:id`. Documents the CURRENT (incorrect) behavior: a non-admin user can
  // change any other user's password. Flip to 403 once the ownership check is added — see
  // docs/architecture/ARCH-015.md Open Questions.
  it("known issue: a non-admin user can currently change another user's password (no ownership check)", async () => {
    const victim = await adminSession
      .post("/api/users")
      .send({ username: "victim", password: "OriginalPass1!" });

    const res = await lisaSession
      .patch(`/api/users/${victim.body.id}/password`)
      .send({ newPassword: "TakenOverPass1!" });
    expect(res.status).toBe(200);
  });
});

// ─── ENV-Sync beim Start ──────────────────────────────────────────────────────

describe("Seeding: ENV-Sync beim Serverstart", () => {
  // TC-015-14
  it("seed-Admin existiert in der users-Tabelle", async () => {
    const res = await adminSession.get("/api/users");
    const admin = (res.body as PublicUser[]).find((u) => u.username === SEED_USER);
    expect(admin).toBeDefined();
    expect(admin?.isAdmin).toBe(1);
  });

  // TC-015-14 (password hash)
  it("seed-Admin hat den korrekten Passwort-Hash aus APP_PASSWORD_HASH", async () => {
    // Bewusst ein frischer, unauthentifizierter Client — testet den Login selbst.
    const res = await request(app).post("/api/auth/login").send({
      username: SEED_USER,
      password: SEED_PASS,
    });
    expect(res.status).toBe(200);
  });
});
