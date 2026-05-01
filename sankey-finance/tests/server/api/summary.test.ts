import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../../../server/createApp";

const { app } = createApp();
const agent = request(app);

async function createAccount(name: string): Promise<number> {
  const res = await agent.post("/api/accounts").send({
    name, bank: "ING", color: "#01696f", type: "checking", iban: null,
  });
  return res.body.id as number;
}

describe("GET /api/summary/:month — Überträge", () => {
  let girokontoId: number;
  let gemeinschaftskontoId: number;

  beforeEach(async () => {
    girokontoId        = await createAccount("Girokonto");
    gemeinschaftskontoId = await createAccount("Gemeinschaftskonto");
  });

  it("enthält transfersIn für das Zielkonto", async () => {
    await agent.post("/api/transactions").send({
      month: "2026-04",
      date: "2026-04-10",
      description: "Überweisung ans Gemeinschaftskonto",
      amount: 200,
      accountId: girokontoId,
      type: "transfer",
      transferToAccountId: gemeinschaftskontoId,
    });

    const res = await agent.get("/api/summary/2026-04");
    expect(res.status).toBe(200);

    const target = res.body.accountSummaries[gemeinschaftskontoId];
    expect(target.transfersIn).toBe(200);
  });

  it("addiert mehrere eingehende Überträge", async () => {
    for (const amount of [100, 150]) {
      await agent.post("/api/transactions").send({
        month: "2026-04",
        description: "Übertrag",
        amount,
        accountId: girokontoId,
        type: "transfer",
        transferToAccountId: gemeinschaftskontoId,
      });
    }

    const res = await agent.get("/api/summary/2026-04");
    const target = res.body.accountSummaries[gemeinschaftskontoId];
    expect(target.transfersIn).toBe(250);
  });

  it("Quellkonto hat transfersIn = 0", async () => {
    await agent.post("/api/transactions").send({
      month: "2026-04",
      description: "Übertrag",
      amount: 200,
      accountId: girokontoId,
      type: "transfer",
      transferToAccountId: gemeinschaftskontoId,
    });

    const res = await agent.get("/api/summary/2026-04");
    const source = res.body.accountSummaries[girokontoId];
    expect(source.transfersIn).toBe(0);
  });

  it("Konto ohne Überträge hat transfersIn = 0", async () => {
    const res = await agent.get("/api/summary/2026-04");
    const target = res.body.accountSummaries[gemeinschaftskontoId];
    expect(target.transfersIn).toBe(0);
  });
});
