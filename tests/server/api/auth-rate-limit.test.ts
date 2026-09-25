/**
 * TC-001-05 — separate file so `authRateLimiter`'s in-memory counter starts fresh (each test file
 * gets its own `createApp()` / process, see vitest.config.ts `pool: "forks"`).
 *
 * The limiter skips itself when NODE_ENV is "test", so this file switches to "development" after
 * all modules are imported (the skip condition is evaluated per request). Auth is enabled with a
 * real bcrypt hash so wrong passwords actually fail. Each test uses its own client IP via
 * X-Forwarded-For (`trust proxy` = 1) so the tests do not share a limiter counter.
 */
import { describe, it, expect, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";

import { listenOnLoopback } from "../loopbackServer";

process.env.APP_PASSWORD_HASH = bcrypt.hashSync("correct-password", 4);

const { createApp } = await import("../../../server/createApp");
const server = await listenOnLoopback(createApp().app);
process.env.NODE_ENV = "development";
afterAll(() => {
  process.env.NODE_ENV = "test";
  server.close();
});
const agent = request(server);

const MAX_FAILED_LOGINS = 10;
const WRONG_LOGIN = { username: "admin", password: "wrong-password" };

describe("authRateLimiter", () => {
  // TC-001-05
  it("should return 429 on the 11th failed login attempt from the same IP", async () => {
    // Arrange
    const clientIp = "203.0.113.1";
    for (let attempt = 0; attempt < MAX_FAILED_LOGINS; attempt++) {
      await agent.post("/api/auth/login").set("X-Forwarded-For", clientIp).send(WRONG_LOGIN);
    }

    // Act
    const res = await agent
      .post("/api/auth/login")
      .set("X-Forwarded-For", clientIp)
      .send(WRONG_LOGIN);

    // Assert
    expect(res.status).toBe(429);
    expect(JSON.stringify(res.body)).toContain("Zu viele Login-Versuche");
  });

  // TC-001-05
  it("should still answer the 10th failed login attempt normally", async () => {
    // Arrange
    const clientIp = "203.0.113.3";
    for (let attempt = 0; attempt < MAX_FAILED_LOGINS - 1; attempt++) {
      await agent.post("/api/auth/login").set("X-Forwarded-For", clientIp).send(WRONG_LOGIN);
    }

    // Act
    const res = await agent
      .post("/api/auth/login")
      .set("X-Forwarded-For", clientIp)
      .send(WRONG_LOGIN);

    // Assert
    expect(res.status).toBe(401);
  });

  // TC-001-05
  it("should not count failed requests to other endpoints as login attempts", async () => {
    // Arrange
    const clientIp = "203.0.113.2";
    for (let attempt = 0; attempt <= MAX_FAILED_LOGINS; attempt++) {
      await agent.get("/api/accounts").set("X-Forwarded-For", clientIp);
    }

    // Act
    const res = await agent
      .post("/api/auth/login")
      .set("X-Forwarded-For", clientIp)
      .send(WRONG_LOGIN);

    // Assert
    expect(res.status).toBe(401);
  });
});
