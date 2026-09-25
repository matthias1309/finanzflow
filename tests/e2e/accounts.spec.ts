import { test, expect } from "@playwright/test";
import { loginAsDevAdmin } from "./authHelpers";

test.beforeEach(async ({ page }) => {
  await loginAsDevAdmin(page);
  await page.goto("/");
  await page.getByTestId("nav-konten").click();
  // Hash routing: the page lives at "/#/accounts"; waitForURL would wait for a full "load" event
  // that an in-page hash change never fires.
  await expect(page).toHaveURL(/\/#\/accounts$/);
});

// TC-002-07 (partial: name visible, bank badge and color dot not asserted)
test("creates a new account", async ({ page }) => {
  await page.getByTestId("button-add-account").click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByTestId("input-account-name").fill("E2E Girokonto");
  await dialog.getByTestId("button-save-account").click();
  await expect(dialog).not.toBeVisible();

  await expect(page.getByText("E2E Girokonto")).toBeVisible();
});

test("edits an account name", async ({ page }) => {
  // Create account first
  await page.getByTestId("button-add-account").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("input-account-name").fill("Alter Name");
  await dialog.getByTestId("button-save-account").click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Alter Name")).toBeVisible();

  // Scope to this test's card — accounts from earlier tests share the E2E database
  const card = page.locator("[data-testid^='account-card-']", { hasText: "Alter Name" });
  await card.locator("[data-testid^='button-edit-account-']").click();

  const editDialog = page.getByRole("dialog");
  await expect(editDialog).toBeVisible();
  await editDialog.getByTestId("input-account-name").fill("Neuer Name");
  await editDialog.getByTestId("button-save-account").click();
  await expect(editDialog).not.toBeVisible();

  await expect(page.getByText("Neuer Name")).toBeVisible();
  await expect(page.getByText("Alter Name")).not.toBeVisible();
});

test("deletes an account", async ({ page }) => {
  // Create account to delete
  await page.getByTestId("button-add-account").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("input-account-name").fill("Zu Löschen");
  await dialog.getByTestId("button-save-account").click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Zu Löschen")).toBeVisible();

  const card = page.locator("[data-testid^='account-card-']", { hasText: "Zu Löschen" });
  await card.locator("[data-testid^='button-delete-account-']").click();

  await expect(page.getByText("Zu Löschen")).not.toBeVisible();
});
