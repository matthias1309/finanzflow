import { test, expect, type Page } from "@playwright/test";
import type { Category } from "@shared/schema";

// ─── Helper: seed an account + transaction via the API ───────────────────────
async function seedData(page: Page) {
  const base = page.context().request;

  const accRes = await base.post("/api/accounts", {
    data: { name: "Dashboard Konto", bank: "ING", color: "#01696f", type: "checking", iban: null },
  });
  const acc = await accRes.json();

  // Get a category ID
  const catRes = await base.get("/api/categories");
  const cats = await catRes.json();
  const incomeCat = (cats as Category[]).find(c => c.type === "income");

  // Create a transaction for the current month so the account shows up
  const today = new Date();
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  await base.post("/api/transactions", {
    data: {
      month,
      date: `${month}-15`,
      description: "Testgehalt",
      amount: 2000,
      accountId: acc.id,
      categoryId: incomeCat.id,
      type: "income",
    },
  });

  return { accountId: acc.id, accountName: "Dashboard Konto" };
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  // Navigate to dashboard (should be default, but ensure)
  await page.waitForURL(/\//);
});

test("Dashboard loads and shows the month selector", async ({ page }) => {
  await expect(page.getByTestId("select-month")).toBeVisible();
});

// TC-008-06 (implicit: no opacity assertion on first load)
test("Account KPI card appears after seeding data", async ({ page }) => {
  const { accountId } = await seedData(page);
  await page.reload();

  const kpi = page.getByTestId(`account-kpi-${accountId}`);
  await expect(kpi).toBeVisible();
  await expect(kpi.getByText("Dashboard Konto")).toBeVisible();
});

// TC-008-01 / TC-008-03 (partial: opacity toggle only, no icon or KPI-total assertions)
test("Clicking an account KPI card toggles visibility", async ({ page }) => {
  const { accountId } = await seedData(page);
  await page.reload();

  const kpi = page.getByTestId(`account-kpi-${accountId}`);
  await expect(kpi).toBeVisible();

  // Click to hide
  await kpi.click();
  await expect(kpi).toHaveClass(/opacity-40/);

  // Click again to show
  await kpi.click();
  await expect(kpi).not.toHaveClass(/opacity-40/);
});

test("Sankey card is rendered on the Dashboard", async ({ page }) => {
  await expect(page.getByTestId("sankey-card")).toBeVisible();
});

// ─── Helper: seed a 3-account transfer cycle (A→B→C→A) via the API ───────────
// AC-004-13's pairwise netting only removes a 2-account reciprocal cycle, so a 3-account
// cycle still reaches d3-sankey as an unlaid-out graph — this exercises ChartErrorBoundary
// itself, independent of the netting fix (see ARCH-009 "Crash resilience").
async function seedTransferCycle(page: Page) {
  const base = page.context().request;
  const today = new Date();
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  async function createAccount(name: string): Promise<number> {
    const res = await base.post("/api/accounts", {
      data: { name, bank: "ING", color: "#01696f", type: "checking", iban: null },
    });
    return (await res.json()).id as number;
  }

  const accountA = await createAccount("Zyklus-Konto A");
  const accountB = await createAccount("Zyklus-Konto B");
  const accountC = await createAccount("Zyklus-Konto C");

  for (const [from, to] of [
    [accountA, accountB],
    [accountB, accountC],
    [accountC, accountA],
  ]) {
    await base.post("/api/transactions", {
      data: {
        month,
        date: `${month}-15`,
        description: "Umbuchung",
        amount: 100,
        accountId: from,
        type: "transfer",
        transferToAccountId: to,
      },
    });
  }
}

// TC-009-08
test("A Sankey chart crash shows a fallback instead of a blank Dashboard", async ({ page }) => {
  const { accountId } = await seedData(page);
  await seedTransferCycle(page);
  await page.reload();

  // Rest of the Dashboard stays usable — this is the point of a chart-scoped boundary.
  await expect(page.getByTestId("select-month")).toBeVisible();
  await expect(page.getByTestId(`account-kpi-${accountId}`)).toBeVisible();

  // Chart falls back instead of leaving the card broken or the page blank.
  await expect(page.getByTestId("sankey-chart-error")).toBeVisible();
  await expect(page.locator("body")).not.toBeEmpty();
});
