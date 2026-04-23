import { describe, it, expect, beforeEach } from "vitest";
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

async function incomeCategory(): Promise<number> {
  const res = await agent.get("/api/categories");
  return res.body.find((c: any) => c.type === "income").id as number;
}

// ─── Single transaction CRUD ──────────────────────────────────────────────────

describe("POST /api/transactions", () => {
  let accountId: number;
  let categoryId: number;

  beforeEach(async () => {
    accountId  = await createAccount();
    categoryId = await incomeCategory();
  });

  it("creates a transaction and returns 201", async () => {
    const res = await agent.post("/api/transactions").send({
      month: "2026-04",
      date: "2026-04-10",
      description: "Gehalt April",
      amount: 3200,
      accountId,
      categoryId,
      type: "income",
    });
    expect(res.status).toBe(201);
    expect(res.body.description).toBe("Gehalt April");
    expect(res.body.amount).toBe(3200);
  });

  it("rejects an invalid transaction type", async () => {
    const res = await agent.post("/api/transactions").send({
      month: "2026-04",
      description: "Test",
      amount: 100,
      accountId,
      type: "other",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a missing accountId", async () => {
    const res = await agent.post("/api/transactions").send({
      month: "2026-04",
      description: "Test",
      amount: 100,
      type: "income",
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/transactions", () => {
  let accountId: number;

  beforeEach(async () => {
    accountId = await createAccount();
    await agent.post("/api/transactions").send({
      month: "2026-03",
      date: "2026-03-15",
      description: "März-Buchung",
      amount: 50,
      accountId,
      type: "expense",
    });
    await agent.post("/api/transactions").send({
      month: "2026-04",
      date: "2026-04-01",
      description: "April-Buchung",
      amount: 100,
      accountId,
      type: "income",
    });
  });

  it("filters by month", async () => {
    const res = await agent.get("/api/transactions?month=2026-04");
    expect(res.status).toBe(200);
    const descriptions = res.body.map((t: any) => t.description);
    expect(descriptions).toContain("April-Buchung");
    expect(descriptions).not.toContain("März-Buchung");
  });

  it("rejects invalid month format on GET", async () => {
    const res = await agent.get("/api/transactions?month=2026-4");
    expect(res.status).toBe(400);
  });
});

// ─── Batch import ─────────────────────────────────────────────────────────────
// The batch endpoint expects a raw JSON array as body.

describe("POST /api/transactions/batch", () => {
  let accountId: number;

  beforeEach(async () => {
    accountId = await createAccount();
  });

  it("saves all valid transactions and returns 201 with created array", async () => {
    const batch = Array.from({ length: 5 }, (_, i) => ({
      month: "2026-04",
      date: `2026-04-0${i + 1}`,
      description: `Buchung ${i + 1}`,
      amount: (i + 1) * 10,
      accountId,
      type: "expense",
    }));

    const res = await agent.post("/api/transactions/batch").send(batch);
    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(5);
    expect(res.body.skipped).toBe(0);
  });

  it("rejects a batch exceeding 500 items", async () => {
    const batch = Array.from({ length: 501 }, (_, i) => ({
      month: "2026-04",
      description: `Buchung ${i}`,
      amount: 1,
      accountId,
      type: "expense",
    }));

    const res = await agent.post("/api/transactions/batch").send(batch);
    expect(res.status).toBe(400);
  });

  it("rejects non-array body", async () => {
    const res = await agent.post("/api/transactions/batch").send({ not: "an array" });
    expect(res.status).toBe(400);
  });

  it("partially succeeds — valid items saved, invalid type skipped", async () => {
    const batch = [
      { month: "2026-04", description: "Valide",    amount: 10, accountId, type: "expense" },
      { month: "2026-04", description: "Ungültig",  amount: 10, accountId, type: "INVALID_TYPE" },
    ];

    const res = await agent.post("/api/transactions/batch").send(batch);
    expect(res.status).toBe(201);
    expect(res.body.created).toHaveLength(1);
    expect(res.body.skipped).toBe(1);
    expect(res.body.errors[0].idx).toBe(1);
  });
});

// ─── Available months ─────────────────────────────────────────────────────────

describe("GET /api/months", () => {
  it("returns an array", async () => {
    const res = await agent.get("/api/months");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("includes a month after a transaction is created for it", async () => {
    const accId = await createAccount();
    await agent.post("/api/transactions").send({
      month: "2025-01",
      description: "Historisch",
      amount: 10,
      accountId: accId,
      type: "expense",
    });

    const res = await agent.get("/api/months");
    expect(res.body).toContain("2025-01");
  });
});
