import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Konten/i }).click();
  await page.waitForURL(/konten/i);
});

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

  // Click the edit button on the account card
  await page.locator("[data-testid^='button-edit-account-']").first().click();

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

  await page.locator("[data-testid^='button-delete-account-']").first().click();

  await expect(page.getByText("Zu Löschen")).not.toBeVisible();
});
