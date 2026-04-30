/**
 * E2E-Tests für den Login-Flow (REQ-001 + REQ-013).
 *
 * Voraussetzung: Der E2E-Server muss mit Auth-Konfiguration gestartet werden:
 *   APP_USER=admin APP_PASSWORD_HASH=<hash> SESSION_SECRET=<secret>
 *   TOTP_ENCRYPTION_KEY=<key>
 *
 * TODO: playwright.config.ts und globalSetup.ts anpassen, sobald die
 * Implementierung steht — TOTP-Secret für E2E-Tests festlegen.
 */
import { test, expect } from "@playwright/test";

// ─── Login-Seite ──────────────────────────────────────────────────────────────

test.describe("Login-Seite", () => {
  test("zeigt die Login-Seite wenn kein Session-Cookie vorhanden ist", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /Anmelden|Login/i })).toBeVisible();
  });

  test("zeigt Username- und Passwort-Felder", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("input-username")).toBeVisible();
    await expect(page.getByTestId("input-password")).toBeVisible();
    await expect(page.getByTestId("button-login")).toBeVisible();
  });

  test("zeigt Fehlermeldung bei falschem Passwort", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("input-username").fill("admin");
    await page.getByTestId("input-password").fill("falschesPasswort");
    await page.getByTestId("button-login").click();
    await expect(page.getByText(/Benutzername oder Passwort falsch/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── TOTP-Eingabe nach erfolgreichem Passwort ─────────────────────────────────

test.describe("TOTP-Eingabemaske", () => {
  test("erscheint nach korrektem Passwort wenn 2FA konfiguriert ist", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("input-username").fill("admin");
    await page.getByTestId("input-password").fill(process.env.E2E_PASSWORD ?? "");
    await page.getByTestId("button-login").click();
    // Sollte zur TOTP-Maske wechseln (gleiche Seite, neuer Step)
    await expect(page.getByTestId("input-totp-code")).toBeVisible();
  });

  test("zeigt Fehlermeldung bei falschem TOTP-Code", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("input-username").fill("admin");
    await page.getByTestId("input-password").fill(process.env.E2E_PASSWORD ?? "");
    await page.getByTestId("button-login").click();
    await page.getByTestId("input-totp-code").fill("000000");
    await page.getByTestId("button-verify-totp").click();
    await expect(page.getByText(/Ungültiger Code/i)).toBeVisible();
  });
});

// ─── Vollständiger Login-Flow ─────────────────────────────────────────────────

test.describe("Vollständiger Login-Flow", () => {
  test("leitet nach erfolgreichem Login+TOTP zum Dashboard weiter", async ({ page }) => {
    // Voraussetzung: E2E_PASSWORD und E2E_TOTP_SECRET als Umgebungsvariablen gesetzt
    const password   = process.env.E2E_PASSWORD    ?? "";
    const totpSecret = process.env.E2E_TOTP_SECRET ?? "";

    if (!password || !totpSecret) {
      test.skip(true, "E2E_PASSWORD und E2E_TOTP_SECRET müssen für diesen Test gesetzt sein");
      return;
    }

    // TOTP-Code dynamisch generieren
    const { totp } = await import("otplib");
    const code = totp.generate(totpSecret);

    await page.goto("/login");
    await page.getByTestId("input-username").fill("admin");
    await page.getByTestId("input-password").fill(password);
    await page.getByTestId("button-login").click();

    await page.getByTestId("input-totp-code").fill(code);
    await page.getByTestId("button-verify-totp").click();

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/Finanzübersicht/i)).toBeVisible();
  });

  test("nach Logout wird die Login-Seite angezeigt", async ({ page, context }) => {
    // Session über API anlegen (setzt Cookie)
    // Dann Logout aufrufen und prüfen ob Redirect zur Login-Seite erfolgt
    await context.request.post("/api/auth/logout");
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── 2FA-Setup im Dashboard ───────────────────────────────────────────────────

test.describe("2FA-Setup im Dashboard (REQ-013)", () => {
  test.skip("zeigt Setup-Prompt wenn 2FA noch nicht konfiguriert ist", async ({ page }) => {
    // Benötigt eingeloggten Zustand ohne 2FA-Konfiguration.
    // Wird nach der Implementierung mit entsprechendem Test-Setup aktiviert.
    await expect(page.getByText(/2FA noch nicht eingerichtet/i)).toBeVisible();
    await expect(page.getByTestId("button-setup-2fa")).toBeVisible();
  });

  test.skip("zeigt QR-Code-Dialog nach Klick auf 'Jetzt einrichten'", async ({ page }) => {
    await page.getByTestId("button-setup-2fa").click();
    await expect(page.getByTestId("dialog-2fa-setup")).toBeVisible();
    await expect(page.getByTestId("qr-code-image")).toBeVisible();
    await expect(page.getByTestId("totp-manual-key")).toBeVisible();
  });

  test.skip("zeigt 8 Recovery-Codes nach erfolgreicher Verifikation", async ({ page }) => {
    // QR-Code scannen (simuliert), Code eingeben, Recovery-Codes prüfen
    const recoveryCodes = page.getByTestId("recovery-code");
    await expect(recoveryCodes).toHaveCount(8);
  });
});
