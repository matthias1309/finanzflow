import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Kategorien/i }).click();
  await page.waitForURL(/kategorien/i);
});

test("creates a new expense category", async ({ page }) => {
  await page.getByTestId("button-add-category").click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByTestId("input-cat-name").fill("E2E Testausgabe");
  // Type is "expense" by default — no change needed
  await dialog.getByTestId("button-save-category").click();

  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("E2E Testausgabe")).toBeVisible();
});

test("edits an existing category", async ({ page }) => {
  // Create a category to edit
  await page.getByTestId("button-add-category").click();
  const createDialog = page.getByRole("dialog");
  await createDialog.getByTestId("input-cat-name").fill("Zu Bearbeiten");
  await createDialog.getByTestId("button-save-category").click();
  await expect(createDialog).not.toBeVisible();

  // Find the category row and hover to reveal the edit button
  const row = page.getByText("Zu Bearbeiten").locator("..").locator("..");
  await row.hover();

  // Click the pencil icon (first button in hover group)
  const editBtn = row.locator("[data-testid^='button-edit-cat-']");
  await editBtn.click();

  const editDialog = page.getByRole("dialog");
  await expect(editDialog).toBeVisible();
  await expect(editDialog.getByTestId("input-cat-name")).toHaveValue("Zu Bearbeiten");

  await editDialog.getByTestId("input-cat-name").fill("Umbenannt");
  await editDialog.getByTestId("button-save-category").click();
  await expect(editDialog).not.toBeVisible();

  await expect(page.getByText("Umbenannt")).toBeVisible();
  await expect(page.getByText("Zu Bearbeiten")).not.toBeVisible();
});

test("deletes a category", async ({ page }) => {
  // Create one to delete
  await page.getByTestId("button-add-category").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("input-cat-name").fill("Zum Löschen");
  await dialog.getByTestId("button-save-category").click();
  await expect(dialog).not.toBeVisible();

  await expect(page.getByText("Zum Löschen")).toBeVisible();

  // Hover the row and click delete
  const row = page.getByText("Zum Löschen").locator("..").locator("..");
  await row.hover();
  const deleteBtn = row.locator("[data-testid^='button-delete-cat-']");
  await deleteBtn.click();

  await expect(page.getByText("Zum Löschen")).not.toBeVisible();
});
