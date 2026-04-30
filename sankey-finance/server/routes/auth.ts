import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";
import { authRateLimiter, safeStringEqual } from "../auth";
import { verifyTotpToken, generateTotpSecret, getTotpAuthUrl } from "../totp";

export const authRouter = Router();

// ─── Hilfsfunktion: Auth-Bypass in dev/test ──────────────────────────────────

function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD_HASH;
}

// ─── Middleware: Session erforderlich (für 2FA-Management-Endpunkte) ─────────

function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (!authEnabled() || req.session?.authenticated) {
    next();
    return;
  }
  res.status(401).json({ message: "Nicht angemeldet" });
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

authRouter.post("/login", authRateLimiter, (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    res.status(400).json({ message: "Benutzername und Passwort erforderlich" });
    return;
  }

  if (!authEnabled()) {
    req.session.authenticated = true;
    res.json({ step: "done" });
    return;
  }

  const hash     = process.env.APP_PASSWORD_HASH!;
  const appUser  = process.env.APP_USER ?? "admin";
  const validUser = safeStringEqual(username, appUser);
  const validPass = bcrypt.compareSync(password, hash);

  if (!validUser || !validPass) {
    res.status(401).json({ message: "Benutzername oder Passwort falsch" });
    return;
  }

  if (!storage.getTotpConfigured()) {
    req.session.authenticated = true;
    res.json({ step: "done" });
    return;
  }

  req.session.pendingTotp   = true;
  req.session.authenticated = false;
  res.json({ step: "totp" });
});

// ─── POST /api/auth/totp ──────────────────────────────────────────────────────

authRouter.post("/totp", (req, res) => {
  if (!authEnabled()) {
    req.session.authenticated = true;
    res.json({ ok: true });
    return;
  }

  if (!req.session?.pendingTotp) {
    res.status(401).json({ message: "Kein ausstehender Login" });
    return;
  }

  const { code } = req.body ?? {};
  if (!code) {
    res.status(400).json({ message: "Code erforderlich" });
    return;
  }

  // Recovery-Code?
  if (storage.verifyAndConsumeRecoveryCode(code)) {
    req.session.pendingTotp   = false;
    req.session.authenticated = true;
    res.json({ ok: true });
    return;
  }

  const secret = storage.getTotpSecret();
  if (!secret) {
    res.status(500).json({ message: "2FA nicht konfiguriert" });
    return;
  }

  // Replay-Schutz: gleicher Code darf pro 30-s-Fenster nur einmal verwendet werden
  if (storage.getTotpLastUsedToken() === code) {
    res.status(401).json({ message: "Ungültiger Code" });
    return;
  }

  if (!verifyTotpToken(code, secret)) {
    res.status(401).json({ message: "Ungültiger Code" });
    return;
  }

  storage.setTotpLastUsedToken(code);
  req.session.pendingTotp   = false;
  req.session.authenticated = true;
  res.json({ ok: true });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// ─── GET /api/auth/status ─────────────────────────────────────────────────────

authRouter.get("/status", (req, res) => {
  res.json({
    authenticated:      !authEnabled() || req.session?.authenticated === true,
    twoFactorRequired:  authEnabled() && storage.getTotpConfigured(),
  });
});

// ─── 2FA-Management ───────────────────────────────────────────────────────────

// Status ist öffentlich (kein sensitiver Inhalt, nur boolean-Flags)
authRouter.get("/2fa/status", (_req, res) => {
  res.json({
    authEnabled:             authEnabled(),
    configured:              storage.getTotpConfigured(),
    recoveryCodesRemaining:  storage.getRecoveryCodesRemaining(),
  });
});

// Setup und Recovery erfordern eingeloggte Session
authRouter.use("/2fa", requireSession);

authRouter.post("/2fa/setup", (req, res) => {
  const appUser = process.env.APP_USER ?? "admin";
  const secret  = generateTotpSecret();
  storage.setPendingTotpSecret(secret);
  res.json({ secret, otpAuthUrl: getTotpAuthUrl(appUser, secret) });
});

authRouter.post("/2fa/verify-setup", (req, res) => {
  const { code } = req.body ?? {};
  if (!code) {
    res.status(400).json({ message: "Code erforderlich" });
    return;
  }

  const pendingSecret = storage.getPendingTotpSecret();
  if (!pendingSecret) {
    res.status(400).json({ message: "Kein Setup ausstehend — bitte zuerst /2fa/setup aufrufen" });
    return;
  }

  if (!verifyTotpToken(code, pendingSecret)) {
    res.status(400).json({ message: "Ungültiger Code — bitte erneut versuchen" });
    return;
  }

  storage.setTotpSecret(pendingSecret);
  storage.clearPendingTotpSecret();
  res.json({ recoveryCodes: storage.generateAndStoreRecoveryCodes() });
});

authRouter.post("/2fa/regenerate-recovery", (_req, res) => {
  res.json({ recoveryCodes: storage.generateAndStoreRecoveryCodes() });
});
