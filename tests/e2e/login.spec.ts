/**
 * E2E-Tests für den Login-Flow (REQ-001 + REQ-013).
 *
 * Der E2E-Server läuft mit NODE_ENV=development, d. h. Auth ist über den Dev-Default aus
 * server/env-defaults.ts aktiv (admin/admin, ohne 2FA). Tests für den TOTP-Schritt legen sich
 * per API einen eigenen Benutzer mit eingerichteter 2FA an (createUserWithTotp).
 *
 * Die App nutzt Hash-Routing: die Login-Seite ist "/#/login", nicht "/login".
 */
import { test, expect } from "@playwright/test";
import { DEV_USERNAME, createUserWithTotp, loginAsDevAdmin, type TotpUser } from "./authHelpers";

const LOGIN_URL = /\/#\/login$/;

// ─── Login-Seite ──────────────────────────────────────────────────────────────

test.describe("Login-Seite", () => {
  test("zeigt die Login-Seite wenn kein Session-Cookie vorhanden ist", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(LOGIN_URL);
    await expect(page.getByRole("heading", { name: /Anmelden|Login/i })).toBeVisible();
  });

  test("zeigt Username- und Passwort-Felder", async ({ page }) => {
    await page.goto("/#/login");
    await expect(page.getByTestId("input-username")).toBeVisible();
    await expect(page.getByTestId("input-password")).toBeVisible();
    await expect(page.getByTestId("button-login")).toBeVisible();
  });

  // TC-001-02
  test("zeigt Fehlermeldung bei falschem Passwort", async ({ page }) => {
    await page.goto("/#/login");
    await page.getByTestId("input-username").fill(DEV_USERNAME);
    await page.getByTestId("input-password").fill("falschesPasswort");
    await page.getByTestId("button-login").click();
    await expect(page.getByText(/Benutzername oder Passwort falsch/i)).toBeVisible();
    await expect(page).toHaveURL(LOGIN_URL);
  });
});

// ─── TOTP-Eingabe nach erfolgreichem Passwort ─────────────────────────────────

test.describe("TOTP-Eingabemaske", () => {
  let totpUser: TotpUser;

  test.beforeEach(async ({ request }) => {
    totpUser = await createUserWithTotp(request);
  });

  // TC-001-01 (partial: TOTP step appears, completed login not asserted)
  test("erscheint nach korrektem Passwort wenn 2FA konfiguriert ist", async ({ page }) => {
    await page.goto("/#/login");
    await page.getByTestId("input-username").fill(totpUser.username);
    await page.getByTestId("input-password").fill(totpUser.password);
    await page.getByTestId("button-login").click();
    // Sollte zur TOTP-Maske wechseln (gleiche Seite, neuer Step)
    await expect(page.getByTestId("input-totp-code")).toBeVisible();
  });

  // TC-001-03
  test("zeigt Fehlermeldung bei falschem TOTP-Code", async ({ page }) => {
    await page.goto("/#/login");
    await page.getByTestId("input-username").fill(totpUser.username);
    await page.getByTestId("input-password").fill(totpUser.password);
    await page.getByTestId("button-login").click();
    await page.getByTestId("input-totp-code").fill("000000");
    await page.getByTestId("button-verify-totp").click();
    await expect(page.getByText(/Ungültiger Code/i)).toBeVisible();
    await expect(page.getByTestId("input-totp-code")).toBeVisible();
  });
});

// ─── Vollständiger Login-Flow ─────────────────────────────────────────────────

test.describe("Vollständiger Login-Flow", () => {
  test("leitet nach erfolgreichem Login+TOTP zum Dashboard weiter", async ({ page }) => {
    // Voraussetzung: E2E_PASSWORD und E2E_TOTP_SECRET als Umgebungsvariablen gesetzt
    const password = process.env.E2E_PASSWORD ?? "";
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

  // TC-001-07
  test("nach Logout wird die Login-Seite angezeigt", async ({ page }) => {
    await loginAsDevAdmin(page);
    await page.goto("/");
    await expect(page.getByTestId("button-logout")).toBeVisible();

    await page.getByTestId("button-logout").click();
    await expect(page).toHaveURL(LOGIN_URL);

    // Session ist serverseitig zerstört: ein erneuter Aufruf landet wieder auf dem Login
    await page.goto("/");
    await expect(page).toHaveURL(LOGIN_URL);
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
