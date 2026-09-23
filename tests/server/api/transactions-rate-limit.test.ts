/**
 * TC-011-04 — separate file so `batchRateLimiter`'s in-memory counter starts fresh and isn't
 * consumed by the other tests in `transactions.test.ts` (same reasoning as
 * `pdf-rate-limit.test.ts`).
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../../server/createApp";

const { app } = createApp();
const agent = request(app);

async function createAccount(): Promise<number> {
  const res = await agent.post("/api/accounts").send({
    name: "Test Konto", bank: "ING", color: "#01696f", type: "checking", iban: null,
  });
  return res.body.id as number;
}

describe("POST /api/transactions/batch — rate limit", () => {
  // TC-011-04
  it("rate-limits batch requests after 20 requests within the window", async () => {
    const accountId = await createAccount();
    const batch = [{ month: "2026-04", description: "X", amount: 1, accountId, type: "expense" }];

    for (let i = 0; i < 20; i++) {
      const res = await agent.post("/api/transactions/batch").send(batch);
      expect(res.status).toBe(201);
    }
    const res = await agent.post("/api/transactions/batch").send(batch);
    expect(res.status).toBe(429);
  });
});
