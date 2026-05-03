/**
 * API-Tests für User-Management (REQ-015).
 *
 * In test mode (NODE_ENV=test) sind Auth und Admin-Middleware deaktiviert.
 * Tests decken Business-Logik ab: CRUD, Last-Admin-Schutz, Passwort-Validierung.
 * Admin-only Zugangskontrolle wird in E2E-Tests mit echten Sessions geprüft.
 *
 * Dynamic import nach env-Setup wie in auth.test.ts — db.ts und createApp.ts
 * lesen APP_USER/APP_PASSWORD_HASH beim Modul-Load für den Seed-User.
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";

const SEED_USER = "admin";
const SEED_PASS = "AdminPass123!";

let app: any;
let adminId: number;

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const bcrypt = await import("bcryptjs");

  process.env.APP_USER            = SEED_USER;
  process.env.APP_PASSWORD_HASH   = bcrypt.default.hashSync(SEED_PASS, 10);
  process.env.SESSION_SECRET      = "test-session-secret-at-least-32-chars!!";
  process.env.TOTP_ENCRYPTION_KEY = "ab".repeat(32);
  process.env.APP_ORIGIN          = "http://localhost:3000";

  const { createApp } = await import("../../../server/createApp");
  ({ app } = createApp());

  const res = await request(app).get("/api/users");
  adminId = res.body.find((u: any) => u.username === SEED_USER)?.id;
});

// ─── GET /api/users ───────────────────────────────────────────────────────────

describe("GET /api/users", () => {
  it("returns 200 with an array containing the seeded admin", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((u: any) => u.username === SEED_USER)).toBe(true);
  });

  it("seeded admin has isAdmin=true", async () => {
    const res = await request(app).get("/api/users");
    const admin = res.body.find((u: any) => u.username === SEED_USER);
    expect(admin.isAdmin).toBe(true);
  });

  it("does not include passwordHash or totpSecret in response", async () => {
    const res = await request(app).get("/api/users");
    res.body.forEach((u: any) => {
      expect(u).not.toHaveProperty("passwordHash");
      expect(u).not.toHaveProperty("totpSecret");
    });
  });
});

// ─── POST /api/users ──────────────────────────────────────────────────────────

describe("POST /api/users", () => {
  it("creates a new user and returns 201", async () => {
    const res = await request(app)
      .post("/api/users")
      .send({ username: "lisa", password: "Password123!" });
    expect(res.status).toBe(201);
    expect(res.body.username).toBe("lisa");
    expect(res.body.isAdmin).toBe(false);
    expect(res.body.totpEnabled).toBe(false);
    expect(res.body).toHaveProperty("id");
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("returns 409 when username is already taken", async () => {
    await request(app)
      .post("/api/users")
      .send({ username: "doppelt", password: "Password123!" });
    const res = await request(app)
      .post("/api/users")
      .send({ username: "doppelt", password: "Password123!" });
    expect(res.status).toBe(409);
  });

  it("returns 400 when username is missing", async () => {
    const res = await request(app)
      .post("/api/users")
      .send({ password: "Password123!" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const res = await request(app)
      .post("/api/users")
      .send({ username: "nopw" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/users")
      .send({ username: "kurzpw", password: "1234567" });
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/users/:id ─────────────────────────────────────────────────────

describe("PATCH /api/users/:id", () => {
  let testUserId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/users")
      .send({ username: "patchuser", password: "Password123!" });
    testUserId = res.body.id;
  });

  it("grants admin rights to a user and returns 200", async () => {
    const res = await request(app)
      .patch(`/api/users/${testUserId}`)
      .send({ isAdmin: true });
    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(true);
  });

  it("revokes admin rights when another admin exists", async () => {
    const res = await request(app)
      .patch(`/api/users/${testUserId}`)
      .send({ isAdmin: false });
    expect(res.status).toBe(200);
    expect(res.body.isAdmin).toBe(false);
  });

  it("returns 409 when trying to demote the last admin", async () => {
    const res = await request(app)
      .patch(`/api/users/${adminId}`)
      .send({ isAdmin: false });
    expect(res.status).toBe(409);
  });

  it("returns 404 for an unknown user id", async () => {
    const res = await request(app)
      .patch("/api/users/99999")
      .send({ isAdmin: true });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────

describe("DELETE /api/users/:id", () => {
  it("deletes a non-admin user and returns 204", async () => {
    const created = await request(app)
      .post("/api/users")
      .send({ username: "todelete", password: "Password123!" });
    const res = await request(app).delete(`/api/users/${created.body.id}`);
    expect(res.status).toBe(204);

    const list = await request(app).get("/api/users");
    expect(list.body.some((u: any) => u.username === "todelete")).toBe(false);
  });

  it("returns 409 when trying to delete the last admin", async () => {
    const res = await request(app).delete(`/api/users/${adminId}`);
    expect(res.status).toBe(409);
  });

  it("returns 404 for an unknown user id", async () => {
    const res = await request(app).delete("/api/users/99999");
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/users/:id/password ───────────────────────────────────────────

describe("PATCH /api/users/:id/password", () => {
  let targetId: number;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/users")
      .send({ username: "pwuser", password: "OldPass123!" });
    targetId = res.body.id;
  });

  it("sets a new password without oldPassword (admin flow) and returns 200", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetId}/password`)
      .send({ newPassword: "NewPass456!" });
    expect(res.status).toBe(200);
  });

  it("returns 400 when newPassword is too short", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetId}/password`)
      .send({ newPassword: "short" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when newPassword is missing", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetId}/password`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 401 when oldPassword is provided but wrong", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetId}/password`)
      .send({ oldPassword: "WrongOld!", newPassword: "NewPass789!" });
    expect(res.status).toBe(401);
  });

  it("changes password when oldPassword is correct", async () => {
    await request(app)
      .patch(`/api/users/${targetId}/password`)
      .send({ newPassword: "KnownPass1!" });

    const res = await request(app)
      .patch(`/api/users/${targetId}/password`)
      .send({ oldPassword: "KnownPass1!", newPassword: "FinalPass2!" });
    expect(res.status).toBe(200);
  });

  it("returns 404 for an unknown user id", async () => {
    const res = await request(app)
      .patch("/api/users/99999/password")
      .send({ newPassword: "NewPass456!" });
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/users/:id/2fa-reset ───────────────────────────────────────────

describe("POST /api/users/:id/2fa-reset", () => {
  it("returns 200 and resets TOTP state for a user", async () => {
    const created = await request(app)
      .post("/api/users")
      .send({ username: "totpuser", password: "Password123!" });
    const res = await request(app).post(`/api/users/${created.body.id}/2fa-reset`);
    expect(res.status).toBe(200);

    const list = await request(app).get("/api/users");
    const user = list.body.find((u: any) => u.id === created.body.id);
    expect(user.totpEnabled).toBe(false);
  });

  it("returns 404 for an unknown user id", async () => {
    const res = await request(app).post("/api/users/99999/2fa-reset");
    expect(res.status).toBe(404);
  });
});

// ─── ENV-Sync beim Start ──────────────────────────────────────────────────────

describe("Seeding: ENV-Sync beim Serverstart", () => {
  it("seed-Admin existiert in der users-Tabelle", async () => {
    const res = await request(app).get("/api/users");
    const admin = res.body.find((u: any) => u.username === SEED_USER);
    expect(admin).toBeDefined();
    expect(admin.isAdmin).toBe(true);
  });

  it("seed-Admin hat den korrekten Passwort-Hash aus APP_PASSWORD_HASH", async () => {
    const bcrypt = await import("bcryptjs");
    const res = await request(app).post("/api/auth/login").send({
      username: SEED_USER,
      password: SEED_PASS,
    });
    expect(res.status).toBe(200);
  });
});
