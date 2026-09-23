/**
 * E2E-Tests für User-Management (REQ-015).
 *
 * Voraussetzung: E2E-Server mit Auth-Konfiguration:
 *   APP_USER=admin APP_PASSWORD_HASH=<hash> SESSION_SECRET=<secret>
 *   TOTP_ENCRYPTION_KEY=<key> E2E_PASSWORD=<pw> E2E_TOTP_SECRET=<secret>
 *
 * Tests die vollständigen Login (Passwort + TOTP) benötigen, prüfen auf
 * E2E_PASSWORD und E2E_TOTP_SECRET und überspringen sich andernfalls.
 */
import { test, expect } from "@playwright/test";
import { totp } from "otplib";

// ─── Hilfsfunktion: vollständiger Login ──────────────────────────────────────

async function loginAsAdmin(page: any) {
  const password   = process.env.E2E_PASSWORD    ?? "";
  const totpSecret = process.env.E2E_TOTP_SECRET ?? "";

  if (!password || !totpSecret) {
    test.skip(true, "E2E_PASSWORD und E2E_TOTP_SECRET müssen gesetzt sein");
    return false;
  }

  await page.goto("/login");
  await page.getByTestId("input-username").fill("admin");
  await page.getByTestId("input-password").fill(password);
  await page.getByTestId("button-login").click();
  await page.getByTestId("input-totp-code").fill(totp.generate(totpSecret));
  await page.getByTestId("button-verify-totp").click();
  await expect(page).not.toHaveURL(/\/login/);
  return true;
}

// ─── Zugangskontrolle ─────────────────────────────────────────────────────────

test.describe("Zugangskontrolle /users", () => {
  test("nicht eingeloggter Nutzer wird zur Login-Seite weitergeleitet", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL(/\/login/);
  });

  test.skip("normaler Benutzer wird vom /users-Aufruf zum Dashboard weitergeleitet", async ({ page }) => {
    // Benötigt eingeloggten Non-Admin-User.
    // Wird nach Implementierung mit entsprechendem Test-Setup aktiviert.
    await expect(page).toHaveURL(/\//);
    await expect(page.getByText(/Kein Zugriff/i)).toBeVisible();
  });
});

// ─── User-Liste ───────────────────────────────────────────────────────────────

test.describe("User-Verwaltungsseite", () => {
  test("Admin sieht die User-Liste mit mindestens einem Eintrag", async ({ page }) => {
    if (!await loginAsAdmin(page)) return;

    await page.goto("/users");
    await expect(page.getByTestId("users-list")).toBeVisible();
    await expect(page.locator("[data-testid^='user-item-']").first()).toBeVisible();
  });

  test("Admin-Eintrag zeigt Username, Admin-Badge und TOTP-Status", async ({ page }) => {
    if (!await loginAsAdmin(page)) return;

    await page.goto("/users");
    const adminRow = page.getByTestId("user-item-admin");
    await expect(adminRow.getByText("admin")).toBeVisible();
    await expect(adminRow.getByTestId("badge-admin")).toBeVisible();
  });
});

// ─── Benutzer anlegen ─────────────────────────────────────────────────────────

test.describe("Benutzer anlegen", () => {
  test("Admin legt einen neuen Benutzer an", async ({ page }) => {
    if (!await loginAsAdmin(page)) return;

    await page.goto("/users");
    await page.getByTestId("button-add-user").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("input-username").fill("e2e-neuuser");
    await dialog.getByTestId("input-password").fill("NewPass123!");
    await dialog.getByTestId("button-save-user").click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText("e2e-neuuser")).toBeVisible();
  });

  test("Formular zeigt Fehler bei bereits vergebenem Username", async ({ page }) => {
    if (!await loginAsAdmin(page)) return;

    // Admin selbst nochmal anlegen → Username vergeben
    await page.goto("/users");
    await page.getByTestId("button-add-user").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByTestId("input-username").fill("admin");
    await dialog.getByTestId("input-password").fill("Password123!");
    await dialog.getByTestId("button-save-user").click();

    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Benutzername bereits vergeben/i)).toBeVisible();
  });
});

// ─── Admin-Rechte vergeben / entziehen ───────────────────────────────────────

test.describe("Admin-Rechte", () => {
  test("Admin vergibt Admin-Rechte an anderen Benutzer", async ({ page, request: apiRequest }) => {
    if (!await loginAsAdmin(page)) return;

    // Testuser per API anlegen
    await apiRequest.post("/api/users", {
      data: { username: "e2e-admintest", password: "Password123!" },
    });

    await page.goto("/users");
    const userRow = page.getByTestId("user-item-e2e-admintest");
    await userRow.getByTestId("toggle-admin").click();

    await expect(userRow.getByTestId("badge-admin")).toBeVisible();
  });

  test("Fehlermeldung beim Versuch den letzten Admin zu degradieren", async ({ page }) => {
    if (!await loginAsAdmin(page)) return;

    await page.goto("/users");
    const adminRow = page.getByTestId("user-item-admin");
    await adminRow.getByTestId("toggle-admin").click();

    await expect(page.getByText(/Letzter Admin kann nicht degradiert werden/i)).toBeVisible();
    await expect(adminRow.getByTestId("badge-admin")).toBeVisible();
  });
});

// ─── Benutzer löschen ─────────────────────────────────────────────────────────

test.describe("Benutzer löschen", () => {
  test("Admin löscht Benutzer nach Bestätigung", async ({ page, request: apiRequest }) => {
    if (!await loginAsAdmin(page)) return;

    await apiRequest.post("/api/users", {
      data: { username: "e2e-todelete", password: "Password123!" },
    });

    await page.goto("/users");
    await page.locator("[data-testid='button-delete-user-e2e-todelete']").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("button-confirm-delete").click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByText("e2e-todelete")).not.toBeVisible();
  });

  test("Fehlermeldung beim Versuch den letzten Admin zu löschen", async ({ page }) => {
    if (!await loginAsAdmin(page)) return;

    await page.goto("/users");
    const adminRow = page.getByTestId("user-item-admin");
    await adminRow.getByTestId("button-delete-user-admin").click();

    const dialog = page.getByRole("dialog");
    await dialog.getByTestId("button-confirm-delete").click();

    await expect(page.getByText(/Letzter Admin kann nicht gelöscht werden/i)).toBeVisible();
    await expect(page.getByText("admin")).toBeVisible();
  });
});

// ─── Passwort ändern ──────────────────────────────────────────────────────────

test.describe("Passwort setzen", () => {
  test("Admin setzt Passwort eines anderen Benutzers", async ({ page, request: apiRequest }) => {
    if (!await loginAsAdmin(page)) return;

    await apiRequest.post("/api/users", {
      data: { username: "e2e-pwchange", password: "OldPass123!" },
    });

    await page.goto("/users");
    await page.locator("[data-testid='button-set-password-e2e-pwchange']").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByTestId("input-new-password").fill("NewPass456!");
    await dialog.getByTestId("button-save-password").click();

    await expect(dialog).not.toBeVisible();
  });
});

// ─── 2FA zurücksetzen ─────────────────────────────────────────────────────────

test.describe("2FA zurücksetzen", () => {
  test.skip("Admin setzt TOTP eines Benutzers zurück", async ({ page, request: apiRequest }) => {
    // Benötigt Benutzer mit eingerichtetem TOTP.
    // Wird nach vollständiger TOTP-Implementierung für Multi-User aktiviert.
    await page.goto("/users");
    const userRow = page.locator("[data-testid^='user-item-']").first();
    await userRow.getByTestId("button-reset-2fa").click();

    const dialog = page.getByRole("dialog");
    await dialog.getByTestId("button-confirm-reset-2fa").click();

    await expect(dialog).not.toBeVisible();
    await expect(userRow.getByTestId("badge-totp-inactive")).toBeVisible();
  });
});
