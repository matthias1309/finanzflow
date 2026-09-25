import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../../server/createApp";
import { listenOnLoopback } from "../loopbackServer";

const server = await listenOnLoopback(createApp().app);
afterAll(() => {
  server.close();
});
const agent = request(server);

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

  // TC-004-11
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

  // TC-004-12
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

  // TC-004-11 (source account unaffected)
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

describe("GET /api/summary/:month — Gegenläufige Überträge (AC-004-13)", () => {
  let tagesgeldId: number;
  let hauptkontoId: number;

  beforeEach(async () => {
    tagesgeldId  = await createAccount("Tagesgeldkonto");
    hauptkontoId = await createAccount("Hauptkonto");
  });

  // TC-004-13
  it("saldiert gegenläufige Überträge zwischen denselben zwei Konten", async () => {
    await agent.post("/api/transactions").send({
      month: "2026-04",
      description: "Umbuchung",
      amount: 1000,
      accountId: tagesgeldId,
      type: "transfer",
      transferToAccountId: hauptkontoId,
    });
    await agent.post("/api/transactions").send({
      month: "2026-04",
      description: "Umbuchung zurück",
      amount: 700,
      accountId: hauptkontoId,
      type: "transfer",
      transferToAccountId: tagesgeldId,
    });

    const res = await agent.get("/api/summary/2026-04");
    expect(res.status).toBe(200);

    const tagesgeld  = res.body.accountSummaries[tagesgeldId];
    const hauptkonto = res.body.accountSummaries[hauptkontoId];

    expect(tagesgeld.transfersOut[hauptkontoId]).toBe(300);
    expect(hauptkonto.transfersOut[tagesgeldId]).toBeUndefined();
    expect(hauptkonto.transfersIn).toBe(300);
    expect(tagesgeld.transfersIn).toBe(0);
  });

  // TC-004-13 (equal amounts net to zero on both sides)
  it("saldiert gleich hohe gegenläufige Überträge vollständig zu null", async () => {
    await agent.post("/api/transactions").send({
      month: "2026-04",
      description: "Umbuchung",
      amount: 500,
      accountId: tagesgeldId,
      type: "transfer",
      transferToAccountId: hauptkontoId,
    });
    await agent.post("/api/transactions").send({
      month: "2026-04",
      description: "Umbuchung zurück",
      amount: 500,
      accountId: hauptkontoId,
      type: "transfer",
      transferToAccountId: tagesgeldId,
    });

    const res = await agent.get("/api/summary/2026-04");
    const tagesgeld  = res.body.accountSummaries[tagesgeldId];
    const hauptkonto = res.body.accountSummaries[hauptkontoId];

    expect(tagesgeld.transfersOut[hauptkontoId]).toBeUndefined();
    expect(hauptkonto.transfersOut[tagesgeldId]).toBeUndefined();
    expect(tagesgeld.transfersIn).toBe(0);
    expect(hauptkonto.transfersIn).toBe(0);
  });
});

describe("GET /api/summary/:month — Bilanz-Berechnung", () => {
  // TC-007-03 (high risk per Test Gap Backlog — Bilanz/Sparquote formula had no direct assertion)
  it("berechnet totalIncome und totalExpenses korrekt für bekannte Eingabedaten", async () => {
    const accountId  = await createAccount("Girokonto");
    const categoryId = (await agent.get("/api/categories")).body.find(
      (c: { type: string }) => c.type === "income"
    ).id;

    await agent.post("/api/transactions").send({
      month: "2026-05", description: "Gehalt", amount: 3000, accountId, categoryId, type: "income",
    });
    await agent.post("/api/transactions").send({
      month: "2026-05", description: "Bonus", amount: 500, accountId, categoryId, type: "income",
    });
    await agent.post("/api/transactions").send({
      month: "2026-05", description: "Miete", amount: 900, accountId, type: "expense",
    });
    await agent.post("/api/transactions").send({
      month: "2026-05", description: "Lebensmittel", amount: 250, accountId, type: "expense",
    });

    const res = await agent.get("/api/summary/2026-05");
    expect(res.status).toBe(200);
    expect(res.body.totalIncome).toBe(3500);
    expect(res.body.totalExpenses).toBe(1150);
  });
});

// Regression test — Test Gap Backlog (Session 9, TC-010-06): AC-010-06 requires GET
// /api/summary/:month to reject an invalid month format with 400, but no such validation exists on
// this route (the sibling GET /api/transactions?month= path does validate). Documents the CURRENT
// behavior; flip to 400 once the route gets the same guard (see docs/architecture/ARCH-010.md Open
// Questions).
describe("GET /api/summary/:month — Monatsformat-Validierung", () => {
  it("known issue: currently returns 200 with an empty summary for an invalid month (AC-010-06)", async () => {
    const res = await request(server).get("/api/summary/2026-4");
    expect(res.status).toBe(200);
    expect(res.body.totalIncome).toBe(0);
    expect(res.body.totalExpenses).toBe(0);
  });
});
