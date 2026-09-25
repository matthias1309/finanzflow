import { test, expect, type Page } from "@playwright/test";
import type { Transaction } from "@shared/schema";
import { loginAsDevAdmin } from "./authHelpers";

// The E2E database lives across tests (and across local runs with a reused server), so every
// test works with its own accounts, IBANs and amounts. Check digits "00" are never valid, so
// these IBANs cannot belong to a real account (security.md).
function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-12);
}

function syntheticIban(suffix: string): string {
  return `DE00${suffix.padStart(18, "0")}`;
}

function uniqueAmount(suffix: string): number {
  return 100 + (Number(suffix) % 90000) / 100;
}

async function createAccount(page: Page, name: string, iban: string | null = null): Promise<number> {
  const res = await page.context().request.post("/api/accounts", {
    data: { name, bank: "N26", color: "#01696f", type: "checking", iban },
  });
  return (await res.json()).id as number;
}

async function storeIncome(page: Page, accountId: number, amount: number): Promise<number> {
  const res = await page.context().request.post("/api/transactions", {
    data: {
      month: "2026-09", date: "2026-09-10", description: "Umbuchung von N26", amount, accountId,
      categoryId: null, type: "income", transferToAccountId: null, importSource: "pdf", originalText: null,
    },
  });
  return (await res.json()).id as number;
}

async function getTransactions(page: Page, accountId: number): Promise<Transaction[]> {
  const res = await page.context().request.get(`/api/transactions?month=2026-09&accountId=${accountId}`);
  return res.json();
}

interface StatementBooking {
  readonly amount: number;
  readonly type: "income" | "expense";
  readonly counterpartyIban: string | null;
}

/** Opens the PDF import, selects the account, and "uploads" a statement with one booking. */
async function importStatement(page: Page, accountName: string, booking: StatementBooking): Promise<void> {
  // A synthetic parse result replaces the PDF — detection, batch save and delete run for real.
  await page.route("**/api/import/pdf", route =>
    route.fulfill({
      json: {
        bank: "N26",
        rawText: "",
        errors: [],
        transactions: [{
          date: "2026-09-09", month: "2026-09", description: "Umbuchung", originalText: "Umbuchung",
          suggestedCategoryId: null, ...booking,
        }],
      },
    }),
  );
  await page.goto("/#/import");
  await page.getByTestId("select-default-account").click();
  await page.getByRole("option", { name: accountName }).click();
  await page.locator("input[type=file]").setInputFiles({
    name: "auszug.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4"),
  });
}

async function chooseNoTransfer(page: Page): Promise<void> {
  await page.getByTestId("select-transfer-target-0").click();
  await page.getByRole("option", { name: "Keine Umbuchung" }).click();
}

test.beforeEach(async ({ page }) => {
  await loginAsDevAdmin(page);
});

// TC-017-11
// Given a preview row marked as a transfer to "DKB Giro"
// When the user selects "Keine Umbuchung" as the target account and clicks "Importieren"
// Then the transaction is stored with type "expense"
// And transferToAccountId is null
test("should store an expense without transfer target after the user selects \"Keine Umbuchung\"", async ({ page }) => {
  // Arrange
  const suffix = uniqueSuffix();
  const dkbIban = syntheticIban(suffix);
  const n26Id = await createAccount(page, `N26 ${suffix}`);
  await createAccount(page, `DKB Giro ${suffix}`, dkbIban);
  await importStatement(page, `N26 ${suffix}`, { amount: uniqueAmount(suffix), type: "expense", counterpartyIban: dkbIban });
  await expect(page.getByTestId("transfer-marker-0")).toHaveText("Umbuchung");

  // Act
  await chooseNoTransfer(page);
  await page.getByRole("button", { name: "1 importieren" }).click();
  await expect(page.getByText("1 Buchungen importiert", { exact: true })).toBeVisible();

  // Assert
  const [stored] = await getTransactions(page, n26Id);
  expect(stored).toMatchObject({ type: "expense", transferToAccountId: null });
});

// TC-017-12
// Given a preview row marked as a counter-booking and excluded by default
// When the user re-includes the row and clicks "Importieren"
// Then the transaction is stored as an income on the selected account
test("should store a counter-booking as income after the user re-includes it", async ({ page }) => {
  // Arrange
  const suffix = uniqueSuffix();
  const n26Iban = syntheticIban(suffix);
  await createAccount(page, `N26 ${suffix}`, n26Iban);
  const dkbId = await createAccount(page, `DKB Giro ${suffix}`);
  await importStatement(page, `DKB Giro ${suffix}`, { amount: uniqueAmount(suffix), type: "income", counterpartyIban: n26Iban });
  await expect(page.getByTestId("transfer-marker-0")).toHaveText(`Gegenbuchung von N26 ${suffix}`);
  const rowCheckbox = page.getByTestId("import-row-0").getByRole("checkbox");
  await expect(rowCheckbox).not.toBeChecked();

  // Act
  await rowCheckbox.check();
  await page.getByRole("button", { name: "1 importieren" }).click();
  await expect(page.getByText("1 Buchungen importiert", { exact: true })).toBeVisible();

  // Assert
  const [stored] = await getTransactions(page, dkbId);
  expect(stored).toMatchObject({ type: "income", transferToAccountId: null });
});

// TC-017-14
// Given a stored income transaction of 300,00 € on "DKB Giro" dated 2026-09-10
// And a preview row for a debit of 300,00 € on "N26" shows "Umbuchung" to "DKB Giro" and "Ersetzt Einnahme vom 10.09.2026"
// When the user clicks "Importieren"
// Then a transaction of type "transfer" from "N26" to "DKB Giro" of 300,00 € is stored
// And the stored income transaction on "DKB Giro" no longer exists
// And GET /api/summary/2026-09 counts the 300,00 € as a transfer only, not as income of "DKB Giro"
test("should delete the replaced stored income after importing the transfer", async ({ page }) => {
  // Arrange
  const suffix = uniqueSuffix();
  const amount = uniqueAmount(suffix);
  const n26Id = await createAccount(page, `N26 ${suffix}`);
  const dkbId = await createAccount(page, `DKB Giro ${suffix}`);
  await storeIncome(page, dkbId, amount);
  await importStatement(page, `N26 ${suffix}`, { amount, type: "expense", counterpartyIban: null });
  await expect(page.getByTestId("transfer-replaces-0")).toHaveText("Ersetzt Einnahme vom 10.09.2026");

  // Act
  await page.getByRole("button", { name: "1 importieren" }).click();
  await expect(page.getByText("1 Buchungen importiert", { exact: true })).toBeVisible();

  // Assert
  const [transfer] = await getTransactions(page, n26Id);
  expect(transfer).toMatchObject({ type: "transfer", transferToAccountId: dkbId, amount });
  expect(await getTransactions(page, dkbId)).toEqual([]);
  const summary = await (await page.context().request.get("/api/summary/2026-09")).json();
  expect(summary.accountSummaries[dkbId]).toMatchObject({ totalIncome: 0, transfersIn: amount });
});

// TC-017-15
// Given a preview row that shows "Umbuchung" to "DKB Giro" and "Ersetzt Einnahme vom 10.09.2026"
// When the user selects "Keine Umbuchung" as the target account and clicks "Importieren"
// Then the row is stored as an expense on "N26"
// And the stored income transaction on "DKB Giro" still exists
test("should keep the stored income when the user overrides the replacing transfer", async ({ page }) => {
  // Arrange
  const suffix = uniqueSuffix();
  const amount = uniqueAmount(suffix);
  const n26Id = await createAccount(page, `N26 ${suffix}`);
  const dkbId = await createAccount(page, `DKB Giro ${suffix}`);
  const incomeId = await storeIncome(page, dkbId, amount);
  await importStatement(page, `N26 ${suffix}`, { amount, type: "expense", counterpartyIban: null });
  await expect(page.getByTestId("transfer-replaces-0")).toBeVisible();

  // Act
  await chooseNoTransfer(page);
  await page.getByRole("button", { name: "1 importieren" }).click();
  await expect(page.getByText("1 Buchungen importiert", { exact: true })).toBeVisible();

  // Assert
  const [expense] = await getTransactions(page, n26Id);
  expect(expense).toMatchObject({ type: "expense", transferToAccountId: null });
  expect(await getTransactions(page, dkbId)).toEqual([expect.objectContaining({ id: incomeId })]);
});

// TC-017-17
// Given a preview row that shows "Ersetzt Einnahme vom 10.09.2026"
// And the server rejects the request that deletes the replaced income transaction
// When the user clicks "Importieren"
// Then the transfer is stored
// And the user sees "Einnahme vom 10.09.2026 konnte nicht entfernt werden"
test("should warn when the replaced income cannot be deleted", async ({ page }) => {
  // Arrange
  const suffix = uniqueSuffix();
  const amount = uniqueAmount(suffix);
  const n26Id = await createAccount(page, `N26 ${suffix}`);
  const dkbId = await createAccount(page, `DKB Giro ${suffix}`);
  const incomeId = await storeIncome(page, dkbId, amount);
  await page.route(`**/api/transactions/${incomeId}`, route => route.fulfill({ status: 500, json: { error: "Fehler" } }));
  await importStatement(page, `N26 ${suffix}`, { amount, type: "expense", counterpartyIban: null });
  await expect(page.getByTestId("transfer-replaces-0")).toBeVisible();

  // Act
  await page.getByRole("button", { name: "1 importieren" }).click();

  // Assert
  await expect(page.getByText("Einnahme vom 10.09.2026 konnte nicht entfernt werden", { exact: true })).toBeVisible();
  const [transfer] = await getTransactions(page, n26Id);
  expect(transfer).toMatchObject({ type: "transfer", transferToAccountId: dkbId });
});
