import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../server/createApp";
import type { Category, Transaction } from "../../../shared/schema";
import { listenOnLoopback } from "../loopbackServer";

const server = await listenOnLoopback(createApp().app);
afterAll(() => {
  server.close();
});
const agent = request(server);

async function createAccount(): Promise<number> {
  const res = await agent.post("/api/accounts").send({
    name: "Test Konto", bank: "ING", color: "#01696f", type: "checking", iban: null,
  });
  return res.body.id as number;
}

async function incomeCategory(): Promise<number> {
  const res = await agent.get("/api/categories");
  const category = (res.body as Category[]).find(c => c.type === "income");
  return category!.id;
}

// ─── Single transaction CRUD ──────────────────────────────────────────────────

describe("POST /api/transactions", () => {
  let accountId: number;
  let categoryId: number;

  beforeEach(async () => {
    accountId  = await createAccount();
    categoryId = await incomeCategory();
  });

  // TC-004-04
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

  // Regression test — Test Gap Backlog (Session 6, TC-004-10). Investigated in Session 10:
  // unlike `GET /api/transactions?month=`, `insertTransactionSchema` has no month-format
  // refinement at all, so `POST /api/transactions` silently accepts a malformed month. Documents
  // the CURRENT behavior; flip to 400 once the schema gets the same `monthSchema` guard used on
  // the GET route (see docs/architecture/ARCH-004.md Open Questions).
  it("known issue: currently accepts an invalid month format on create (AC-004-10)", async () => {
    const res = await agent.post("/api/transactions").send({
      month: "2026-4",
      description: "Test",
      amount: 100,
      accountId,
      type: "income",
    });
    expect(res.status).toBe(201);
  });

  // TC-004-05
  it("creates a transfer transaction and returns 201", async () => {
    const targetAccountId = await createAccount();
    const res = await agent.post("/api/transactions").send({
      month: "2026-04",
      description: "Übertrag",
      amount: 200,
      accountId,
      type: "transfer",
      transferToAccountId: targetAccountId,
    });
    expect(res.status).toBe(201);
    expect(res.body.type).toBe("transfer");
    expect(res.body.transferToAccountId).toBe(targetAccountId);
  });

  // Regression test — Test Gap Backlog (Session 6, TC-004-09): AC-004-09 requires the server to
  // reject a negative `amount`, but no `.positive()` refinement exists on
  // `insertTransactionSchema`. This documents the CURRENT (incorrect) behavior; flip the expected
  // status to 400 once the schema is fixed (see docs/architecture/ARCH-004.md Open Questions).
  it("known issue: currently accepts a negative amount instead of rejecting it (AC-004-09)", async () => {
    const res = await agent.post("/api/transactions").send({
      month: "2026-04",
      description: "Negativer Betrag",
      amount: -50,
      accountId,
      categoryId,
      type: "income",
    });
    expect(res.status).toBe(201);
  });

  // Regression test — Test Gap Backlog (Session 6, TC-004-06): AC-004-06 requires a transfer to
  // specify a target account, but the server accepts `transferToAccountId: null` and `summary.ts`
  // then silently drops the amount from both accounts' totals. Documents the CURRENT behavior; flip
  // to 400 once the schema/route validates this (see docs/architecture/ARCH-004.md Open Questions).
  it("known issue: currently accepts a transfer with no transferToAccountId (AC-004-06)", async () => {
    const res = await agent.post("/api/transactions").send({
      month: "2026-04",
      description: "Übertrag ohne Ziel",
      amount: 100,
      accountId,
      type: "transfer",
      transferToAccountId: null,
    });
    expect(res.status).toBe(201);
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

  // TC-004-02
  it("filters by month", async () => {
    const res = await agent.get("/api/transactions?month=2026-04");
    expect(res.status).toBe(200);
    const descriptions = (res.body as Transaction[]).map(t => t.description);
    expect(descriptions).toContain("April-Buchung");
    expect(descriptions).not.toContain("März-Buchung");
  });

  it("rejects invalid month format on GET", async () => {
    const res = await agent.get("/api/transactions?month=2026-4");
    expect(res.status).toBe(400);
  });

  it("rejects a non-numeric accountId", async () => {
    const res = await agent.get("/api/transactions?accountId=abc");
    expect(res.status).toBe(400);
  });

  // TC-004-03
  it("filters by accountId", async () => {
    const otherAccountId = await createAccount();
    await agent.post("/api/transactions").send({
      month: "2026-04",
      description: "Anderes Konto",
      amount: 30,
      accountId: otherAccountId,
      type: "expense",
    });

    const res = await agent.get(`/api/transactions?accountId=${accountId}`);
    expect(res.status).toBe(200);
    const ids = (res.body as Transaction[]).map(t => t.accountId);
    expect(ids.every(id => id === accountId)).toBe(true);
  });
});

describe("PATCH /api/transactions/:id", () => {
  let accountId: number;
  let categoryId: number;
  let txId: number;

  beforeEach(async () => {
    accountId  = await createAccount();
    categoryId = await incomeCategory();
    const created = await agent.post("/api/transactions").send({
      month: "2026-04",
      description: "Ursprünglich",
      amount: 100,
      accountId,
      type: "income",
    });
    txId = created.body.id;
  });

  // TC-004-07
  it("updates the category of a transaction", async () => {
    const res = await agent.patch(`/api/transactions/${txId}`).send({ categoryId });
    expect(res.status).toBe(200);
    expect(res.body.categoryId).toBe(categoryId);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await agent.patch("/api/transactions/99999").send({ categoryId });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await agent.patch("/api/transactions/abc").send({ categoryId });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/transactions/:id", () => {
  let accountId: number;
  let txId: number;

  beforeEach(async () => {
    accountId = await createAccount();
    const created = await agent.post("/api/transactions").send({
      month: "2026-04", description: "Original", amount: 100, accountId, type: "income",
    });
    txId = created.body.id;
  });

  it("fully replaces the transaction", async () => {
    const res = await agent.put(`/api/transactions/${txId}`).send({
      month: "2026-04", description: "Ersetzt", amount: 150, accountId, type: "income",
    });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe("Ersetzt");
    expect(res.body.amount).toBe(150);
  });

  it("returns 404 for an unknown id", async () => {
    const res = await agent.put("/api/transactions/99999").send({
      month: "2026-04", description: "X", amount: 1, accountId, type: "income",
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await agent.put("/api/transactions/abc").send({
      month: "2026-04", description: "X", amount: 1, accountId, type: "income",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid body", async () => {
    const res = await agent.put(`/api/transactions/${txId}`).send({ description: "Unvollständig" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/transactions/:id", () => {
  // TC-004-08
  it("deletes a transaction", async () => {
    const accountId = await createAccount();
    const created = await agent.post("/api/transactions").send({
      month: "2026-04",
      description: "Zu löschen",
      amount: 20,
      accountId,
      type: "expense",
    });

    const res = await agent.delete(`/api/transactions/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const list = await agent.get(`/api/transactions?accountId=${accountId}`);
    const ids = (list.body as Transaction[]).map(t => t.id);
    expect(ids).not.toContain(created.body.id);
  });
});

// ─── Batch import ─────────────────────────────────────────────────────────────
// The batch endpoint expects a raw JSON array as body.

describe("POST /api/transactions/batch", () => {
  let accountId: number;

  beforeEach(async () => {
    accountId = await createAccount();
  });

  // TC-011-01
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

  // TC-011-03
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

  // TC-011-02
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

  // TC-010-02 (partial — created month appears; ordering/UI-merge not covered)
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
