import { describe, it, expect, afterEach, afterAll } from "vitest";
import request from "supertest";

import { createApp } from "../../../server/createApp";
import type { Transaction, TransferDetectionRow } from "../../../shared/schema";
import { listenOnLoopback } from "../loopbackServer";

const server = await listenOnLoopback(createApp().app);
afterAll(() => {
  server.close();
});
const agent = request(server);

// Public example IBANs — never real account data in tests (security.md).
const N26_IBAN = "DE89370400440532013000";
const DKB_IBAN = "DE02120300000000202051";
const FOREIGN_IBAN = "DE44500105175407324931";

// Every test file shares one in-memory DB; accounts with the same IBAN from an earlier test
// would make the IBAN lookup ambiguous, so each test removes what it created.
const createdAccountIds: number[] = [];
const createdTransactionIds: number[] = [];

afterEach(async () => {
  await Promise.all(createdTransactionIds.splice(0).map(id => agent.delete(`/api/transactions/${id}`)));
  await Promise.all(createdAccountIds.splice(0).map(id => agent.delete(`/api/accounts/${id}`)));
});

async function createAccount(name: string, iban: string | null = null): Promise<number> {
  const res = await agent.post("/api/accounts").send({
    name, bank: "N26", color: "#01696f", type: "checking", iban,
  });
  createdAccountIds.push(res.body.id);
  return res.body.id as number;
}

interface StoredTransactionInput {
  readonly accountId: number;
  readonly date: string;
  readonly amount: number;
  readonly type: "income" | "expense" | "transfer";
  readonly transferToAccountId?: number;
}

async function storeTransaction(input: StoredTransactionInput): Promise<Transaction> {
  const res = await agent.post("/api/transactions").send({
    month: input.date.slice(0, 7),
    date: input.date,
    description: "Gespeicherte Buchung",
    amount: input.amount,
    accountId: input.accountId,
    categoryId: null,
    type: input.type,
    transferToAccountId: input.transferToAccountId ?? null,
    importSource: "pdf",
    originalText: null,
  });
  createdTransactionIds.push(res.body.id);
  return res.body as Transaction;
}

function previewRow(row: Partial<TransferDetectionRow> & { accountId: number }): TransferDetectionRow {
  return { date: "2026-09-01", amount: 500, type: "expense", counterpartyIban: null, ...row };
}

describe("POST /api/transfers/detect", () => {
  // TC-017-01
  // Given own accounts "N26" and "DKB Giro" exist and "DKB Giro" has the IBAN "DE02120300000000202051"
  // And a statement for "N26" contains a debit of 500,00 € whose counterparty IBAN is "DE02120300000000202051"
  // When the user uploads the statement and selects "N26" as the account in the preview
  // Then the preview row shows "Umbuchung"
  // And its target account is "DKB Giro"
  it("should suggest a transfer to the own account whose IBAN is the counterparty IBAN of a debit", async () => {
    // Arrange
    const n26Id = await createAccount("N26");
    const dkbId = await createAccount("DKB Giro", DKB_IBAN);

    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [previewRow({ accountId: n26Id, counterpartyIban: DKB_IBAN })],
    });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([
      { kind: "transfer", targetAccountId: dkbId, basis: "iban", replacesTransaction: null },
    ]);
  });

  // TC-017-02
  // Given the preview row from AC-017-01 is marked as a transfer to "DKB Giro"
  // When the user clicks "Importieren"
  // Then the transaction is stored with type "transfer" and transferToAccountId of "DKB Giro"
  // And it is not counted in the expenses of "N26" in GET /api/summary/:month
  it("should exclude an imported transfer from the source account expenses in the summary", async () => {
    // Arrange
    const n26Id = await createAccount("N26");
    const dkbId = await createAccount("DKB Giro", DKB_IBAN);

    // Act
    const batch = await agent.post("/api/transactions/batch").send([{
      month: "2026-09", date: "2026-09-01", description: "Umbuchung", amount: 500,
      accountId: n26Id, categoryId: null, type: "transfer", transferToAccountId: dkbId,
      importSource: "pdf", originalText: null,
    }]);
    createdTransactionIds.push(batch.body.created[0].id);
    const summary = await agent.get("/api/summary/2026-09");

    // Assert
    expect(batch.body.created[0]).toMatchObject({ type: "transfer", transferToAccountId: dkbId });
    expect(summary.body.accountSummaries[n26Id].totalExpenses).toBe(0);
    expect(summary.body.accountSummaries[n26Id].transfersOut[dkbId]).toBe(500);
  });

  // TC-017-03
  // Given own accounts "N26" with the IBAN "DE89370400440532013000" and "DKB Giro" exist
  // And a statement for "DKB Giro" contains a credit of 500,00 € whose counterparty IBAN is "DE89370400440532013000"
  // When the user uploads the statement and selects "DKB Giro" as the account in the preview
  // Then the preview row shows "Gegenbuchung von N26"
  // And the row is excluded from the import by default
  it("should suggest a counter-booking for a credit whose counterparty IBAN belongs to another own account", async () => {
    // Arrange
    const n26Id = await createAccount("N26", N26_IBAN);
    const dkbId = await createAccount("DKB Giro");

    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [previewRow({ accountId: dkbId, type: "income", counterpartyIban: N26_IBAN })],
    });

    // Assert
    expect(res.body.suggestions).toEqual([
      { kind: "counterBooking", sourceAccountId: n26Id, basis: "iban" },
    ]);
  });

  // TC-017-04
  // Given no own account has the IBAN "DE44500105175407324931"
  // And a statement contains a debit of 80,00 € whose counterparty IBAN is "DE44500105175407324931"
  // When the user uploads the statement
  // Then the preview row is an expense
  // And no target account is set
  it("should not suggest a transfer when the counterparty IBAN belongs to no own account", async () => {
    // Arrange
    const n26Id = await createAccount("N26");
    const dkbId = await createAccount("DKB Giro", DKB_IBAN);
    await storeTransaction({ accountId: dkbId, date: "2026-09-01", amount: 80, type: "income" });

    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [previewRow({ accountId: n26Id, amount: 80, counterpartyIban: FOREIGN_IBAN })],
    });

    // Assert
    expect(res.body.suggestions).toEqual([{ kind: "none" }]);
  });

  // TC-017-05
  // Given the own account "N26" has the IBAN "DE89370400440532013000"
  // And a statement contains a booking whose counterparty IBAN is "DE89370400440532013000"
  // When the user selects "N26" as the account in the preview
  // Then the preview row is not marked as a transfer
  it("should not suggest a transfer when the counterparty IBAN is the IBAN of the selected account itself", async () => {
    // Arrange
    const n26Id = await createAccount("N26", N26_IBAN);

    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [previewRow({ accountId: n26Id, counterpartyIban: N26_IBAN })],
    });

    // Assert
    expect(res.body.suggestions).toEqual([{ kind: "none" }]);
  });

  // TC-017-06
  // Given the own account "DKB Giro" has the IBAN "DE02120300000000202051"
  // And a statement lists the counterparty IBAN as "de02 1203 0000 0000 2020 51"
  // When the user uploads the statement and selects another own account in the preview
  // Then the preview row is marked as a transfer to "DKB Giro"
  it("should match the counterparty IBAN regardless of spaces and letter case", async () => {
    // Arrange
    const n26Id = await createAccount("N26");
    const dkbId = await createAccount("DKB Giro", DKB_IBAN);

    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [previewRow({ accountId: n26Id, counterpartyIban: "de02 1203 0000 0000 2020 51" })],
    });

    // Assert
    expect(res.body.suggestions[0]).toMatchObject({ kind: "transfer", targetAccountId: dkbId });
  });

  // TC-017-07
  // Given a stored transaction of type "transfer" from "N26" to "DKB Giro" of 500,00 € dated 2026-09-01
  // And a statement for "DKB Giro" contains a credit of 500,00 € dated 2026-09-02 without a counterparty IBAN
  // When the user uploads the statement and selects "DKB Giro" as the account in the preview
  // Then the preview row is suggested as the counter-booking of that transfer
  // And the row is excluded from the import by default
  it("should suggest a counter-booking when a credit without IBAN matches a stored outgoing transfer", async () => {
    // Arrange
    const n26Id = await createAccount("N26");
    const dkbId = await createAccount("DKB Giro");
    await storeTransaction({
      accountId: n26Id, date: "2026-09-01", amount: 500, type: "transfer", transferToAccountId: dkbId,
    });

    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [previewRow({ accountId: dkbId, date: "2026-09-02", type: "income" })],
    });

    // Assert
    expect(res.body.suggestions).toEqual([
      { kind: "counterBooking", sourceAccountId: n26Id, basis: "match" },
    ]);
  });

  // TC-017-08
  // Given a stored income transaction of 300,00 € on "DKB Giro" dated 2026-09-10
  // And a statement for "N26" contains a debit of 300,00 € dated 2026-09-09 without a counterparty IBAN
  // When the user uploads the statement and selects "N26" as the account in the preview
  // Then the preview row shows "Umbuchung" with the target account "DKB Giro"
  // And the row shows "Ersetzt Einnahme vom 10.09.2026"
  it("should suggest a transfer replacing the stored income when a debit without IBAN matches it", async () => {
    // Arrange
    const n26Id = await createAccount("N26");
    const dkbId = await createAccount("DKB Giro");
    const income = await storeTransaction({ accountId: dkbId, date: "2026-09-10", amount: 300, type: "income" });

    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [previewRow({ accountId: n26Id, date: "2026-09-09", amount: 300 })],
    });

    // Assert
    expect(res.body.suggestions).toEqual([{
      kind: "transfer",
      targetAccountId: dkbId,
      basis: "match",
      replacesTransaction: { id: income.id, date: "2026-09-10" },
    }]);
  });

  // TC-017-09
  // Given a stored transaction of type "transfer" from "N26" to "DKB Giro" of 500,00 € dated 2026-09-01
  // And a statement for "DKB Giro" contains a credit of 500,00 € dated 2026-09-10 without a counterparty IBAN
  // When the user uploads the statement and selects "DKB Giro" as the account in the preview
  // Then the preview row is an income
  // And it is included in the import by default
  it("should not match a credit whose date is outside the three-day window", async () => {
    // Arrange
    const n26Id = await createAccount("N26");
    const dkbId = await createAccount("DKB Giro");
    await storeTransaction({
      accountId: n26Id, date: "2026-09-01", amount: 500, type: "transfer", transferToAccountId: dkbId,
    });

    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [previewRow({ accountId: dkbId, date: "2026-09-10", type: "income" })],
    });

    // Assert
    expect(res.body.suggestions).toEqual([{ kind: "none" }]);
  });

  // TC-017-09 (amount part: a one-cent difference is no match)
  it("should not match a credit whose amount differs by one cent", async () => {
    // Arrange
    const n26Id = await createAccount("N26");
    const dkbId = await createAccount("DKB Giro");
    await storeTransaction({
      accountId: n26Id, date: "2026-09-01", amount: 500, type: "transfer", transferToAccountId: dkbId,
    });

    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [previewRow({ accountId: dkbId, amount: 500.01, type: "income" })],
    });

    // Assert
    expect(res.body.suggestions).toEqual([{ kind: "none" }]);
  });

  // TC-017-10
  // Given two stored outgoing transfers of 500,00 € from different own accounts to "DKB Giro" within the matching window
  // And a statement for "DKB Giro" contains a credit of 500,00 € without a counterparty IBAN
  // When the user uploads the statement and selects "DKB Giro" as the account in the preview
  // Then the preview row is an income
  // And no counter-booking is suggested
  it("should not suggest a counter-booking when two stored transfers match", async () => {
    // Arrange
    const n26Id = await createAccount("N26");
    const ingId = await createAccount("ING");
    const dkbId = await createAccount("DKB Giro");
    await storeTransaction({
      accountId: n26Id, date: "2026-09-01", amount: 500, type: "transfer", transferToAccountId: dkbId,
    });
    await storeTransaction({
      accountId: ingId, date: "2026-09-02", amount: 500, type: "transfer", transferToAccountId: dkbId,
    });

    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [previewRow({ accountId: dkbId, date: "2026-09-02", type: "income" })],
    });

    // Assert
    expect(res.body.suggestions).toEqual([{ kind: "none" }]);
  });

  // TC-017-16
  // Given own accounts "N26" and "DKB Giro" exist and "DKB Giro" has the IBAN "DE02120300000000202051"
  // And a stored income transaction of 500,00 € on "DKB Giro" dated 2026-09-02
  // And a statement for "N26" contains a debit of 500,00 € dated 2026-09-01 whose counterparty IBAN is "DE02120300000000202051"
  // When the user uploads the statement and selects "N26" as the account in the preview
  // Then the preview row shows "Umbuchung" with the target account "DKB Giro"
  // And the row shows "Ersetzt Einnahme vom 02.09.2026"
  it("should attach the matching stored income on the target account to a transfer detected by IBAN", async () => {
    // Arrange
    const n26Id = await createAccount("N26");
    const dkbId = await createAccount("DKB Giro", DKB_IBAN);
    const income = await storeTransaction({ accountId: dkbId, date: "2026-09-02", amount: 500, type: "income" });

    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [previewRow({ accountId: n26Id, counterpartyIban: DKB_IBAN })],
    });

    // Assert
    expect(res.body.suggestions).toEqual([{
      kind: "transfer",
      targetAccountId: dkbId,
      basis: "iban",
      replacesTransaction: { id: income.id, date: "2026-09-02" },
    }]);
  });

  // TC-017-16 (ambiguous replacement: the transfer stays, nothing is replaced)
  it("should keep the IBAN transfer but replace nothing when two stored incomes match", async () => {
    // Arrange
    const n26Id = await createAccount("N26");
    const dkbId = await createAccount("DKB Giro", DKB_IBAN);
    await storeTransaction({ accountId: dkbId, date: "2026-09-01", amount: 500, type: "income" });
    await storeTransaction({ accountId: dkbId, date: "2026-09-02", amount: 500, type: "income" });

    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [previewRow({ accountId: n26Id, counterpartyIban: DKB_IBAN })],
    });

    // Assert
    expect(res.body.suggestions).toEqual([
      { kind: "transfer", targetAccountId: dkbId, basis: "iban", replacesTransaction: null },
    ]);
  });

  // TC-017-21
  // Given a detection request with 501 rows, a negative amount, or a counterpartyIban longer than 42 characters
  // When POST /api/transfers/detect is called
  // Then the response status is 400
  it("should return 400 for a request with more than 500 rows", async () => {
    // Arrange
    const rows = Array.from({ length: 501 }, () => previewRow({ accountId: 1 }));

    // Act
    const res = await agent.post("/api/transfers/detect").send({ rows });

    // Assert
    expect(res.status).toBe(400);
  });

  // TC-017-21
  it("should return 400 for a negative amount", async () => {
    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [previewRow({ accountId: 1, amount: -5 })],
    });

    // Assert
    expect(res.status).toBe(400);
  });

  // TC-017-21
  it("should return 400 for a counterparty IBAN longer than 42 characters", async () => {
    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [previewRow({ accountId: 1, counterpartyIban: "D".repeat(43) })],
    });

    // Assert
    expect(res.status).toBe(400);
  });

  // TC-017-22
  // Given one stored transfer of 500,00 € from "N26" to "DKB Giro" dated 2026-09-01
  // And two credit rows of 500,00 € on "DKB Giro" dated 2026-09-01 and 2026-09-02 without a counterparty IBAN
  // When POST /api/transfers/detect is called with both rows
  // Then both suggestions are "none"
  it("should suggest nothing when two rows match the same stored transfer", async () => {
    // Arrange
    const n26Id = await createAccount("N26");
    const dkbId = await createAccount("DKB Giro");
    await storeTransaction({
      accountId: n26Id, date: "2026-09-01", amount: 500, type: "transfer", transferToAccountId: dkbId,
    });

    // Act
    const res = await agent.post("/api/transfers/detect").send({
      rows: [
        previewRow({ accountId: dkbId, date: "2026-09-01", type: "income" }),
        previewRow({ accountId: dkbId, date: "2026-09-02", type: "income" }),
      ],
    });

    // Assert
    expect(res.body.suggestions).toEqual([{ kind: "none" }, { kind: "none" }]);
  });
});
