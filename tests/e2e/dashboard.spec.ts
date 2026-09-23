import { test, expect, type Page } from "@playwright/test";

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
  const incomeCat = cats.find((c: any) => c.type === "income");

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

test("Account KPI card appears after seeding data", async ({ page }) => {
  const { accountId } = await seedData(page);
  await page.reload();

  const kpi = page.getByTestId(`account-kpi-${accountId}`);
  await expect(kpi).toBeVisible();
  await expect(kpi.getByText("Dashboard Konto")).toBeVisible();
});

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
