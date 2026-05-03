import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";
import { authRateLimiter } from "../auth";
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

// ─── Middleware: Step-up-Verifikation (für destruktive 2FA-Operationen) ──────

const STEP_UP_VALIDITY_MS = 5 * 60 * 1000;

function requireStepUp(req: Request, res: Response, next: NextFunction): void {
  const userId = req.session?.userId;
  if (!authEnabled() || !userId || !storage.getUserTotpConfigured(userId)) { next(); return; }
  const stepUpAt = req.session?.stepUpAt ?? 0;
  if (Date.now() - stepUpAt <= STEP_UP_VALIDITY_MS) { next(); return; }
  res.status(403).json({ message: "Step-up-Verifizierung erforderlich", code: "STEP_UP_REQUIRED" });
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

  const user = storage.getUserByUsername(username);
  const hashToCheck = user?.passwordHash ?? "$2b$10$invalidhashfortimingsafety000000000000000000000";
  const validPass = bcrypt.compareSync(password, hashToCheck);

  if (!user || !validPass) {
    res.status(401).json({ message: "Benutzername oder Passwort falsch" });
    return;
  }

  if (!storage.getUserTotpConfigured(user.id)) {
    req.session.regenerate((err) => {
      if (err) { res.status(500).json({ message: "Session-Fehler" }); return; }
      req.session.userId        = user.id;
      req.session.authenticated = true;
      res.json({ step: "done" });
    });
    return;
  }

  req.session.regenerate((err) => {
    if (err) { res.status(500).json({ message: "Session-Fehler" }); return; }
    req.session.userId        = user.id;
    req.session.pendingTotp   = true;
    req.session.authenticated = false;
    res.json({ step: "totp" });
  });
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

  const userId = req.session.userId!;

  if (storage.verifyAndConsumeUserRecoveryCode(userId, code)) {
    req.session.regenerate((err) => {
      if (err) { res.status(500).json({ message: "Session-Fehler" }); return; }
      req.session.userId        = userId;
      req.session.authenticated = true;
      res.json({ ok: true });
    });
    return;
  }

  const secret = storage.getUserTotpSecret(userId);
  if (!secret) {
    res.status(500).json({ message: "2FA nicht konfiguriert" });
    return;
  }

  if (storage.getUserTotpLastUsedToken(userId) === code) {
    res.status(401).json({ message: "Ungültiger Code" });
    return;
  }

  if (!verifyTotpToken(code, secret)) {
    res.status(401).json({ message: "Ungültiger Code" });
    return;
  }

  storage.setUserTotpLastUsedToken(userId, code);
  req.session.regenerate((err) => {
    if (err) { res.status(500).json({ message: "Session-Fehler" }); return; }
    req.session.userId        = userId;
    req.session.authenticated = true;
    res.json({ ok: true });
  });
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
  const userId = req.session?.userId;
  res.json({
    authenticated:     !authEnabled() || req.session?.authenticated === true,
    twoFactorRequired: authEnabled() && userId ? storage.getUserTotpConfigured(userId) : false,
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

authRouter.get("/me", (req, res) => {
  if (!authEnabled()) {
    res.json({ username: "admin", isAdmin: true });
    return;
  }
  const userId = req.session?.userId;
  if (!userId || !req.session?.authenticated) {
    res.status(401).json({ message: "Nicht angemeldet" });
    return;
  }
  const user = storage.getUserById(userId);
  if (!user) { res.status(401).json({ message: "Nicht angemeldet" }); return; }
  res.json({ username: user.username, isAdmin: user.isAdmin === 1 });
});

// ─── POST /api/auth/step-up ───────────────────────────────────────────────────

authRouter.post("/step-up", requireSession, (req, res) => {
  const userId = req.session?.userId;
  if (!userId || !storage.getUserTotpConfigured(userId)) {
    res.status(400).json({ message: "2FA nicht konfiguriert" });
    return;
  }

  const { code } = req.body ?? {};
  if (!code) {
    res.status(400).json({ message: "Code erforderlich" });
    return;
  }

  const secret = storage.getUserTotpSecret(userId);
  if (!secret) {
    res.status(500).json({ message: "TOTP-Secret fehlt" });
    return;
  }

  if (storage.getUserTotpLastUsedToken(userId) === code) {
    res.status(401).json({ message: "Dieser Code wurde bereits verwendet" });
    return;
  }

  if (!verifyTotpToken(code, secret)) {
    res.status(401).json({ message: "Ungültiger Code" });
    return;
  }

  storage.setUserTotpLastUsedToken(userId, code);
  req.session.stepUpAt = Date.now();
  res.json({ ok: true });
});

// ─── 2FA-Management ───────────────────────────────────────────────────────────

authRouter.get("/2fa/status", (req, res) => {
  const userId = req.session?.userId;
  if (userId) {
    res.json({
      authEnabled:            authEnabled(),
      configured:             storage.getUserTotpConfigured(userId),
      recoveryCodesRemaining: storage.getUserRecoveryCodesRemaining(userId),
    });
    return;
  }
  // Fallback für nicht-authentifizierte Requests: Status des Seed-Admins
  const appUser = storage.getUserByUsername(process.env.APP_USER ?? "admin");
  res.json({
    authEnabled:            authEnabled(),
    configured:             appUser ? storage.getUserTotpConfigured(appUser.id) : false,
    recoveryCodesRemaining: appUser ? storage.getUserRecoveryCodesRemaining(appUser.id) : 0,
  });
});

authRouter.use("/2fa", requireSession);

authRouter.post("/2fa/setup", requireStepUp, (req, res) => {
  const userId   = req.session?.userId;
  const username = userId ? (storage.getUserById(userId)?.username ?? "admin") : "admin";
  const secret   = generateTotpSecret();
  if (userId) storage.setUserPendingTotpSecret(userId, secret);
  res.json({ secret, otpAuthUrl: getTotpAuthUrl(username, secret) });
});

authRouter.post("/2fa/verify-setup", requireStepUp, (req, res) => {
  const { code } = req.body ?? {};
  if (!code) {
    res.status(400).json({ message: "Code erforderlich" });
    return;
  }

  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ message: "Nicht angemeldet" }); return; }

  const pendingSecret = storage.getUserPendingTotpSecret(userId);
  if (!pendingSecret) {
    res.status(400).json({ message: "Kein Setup ausstehend — bitte zuerst /2fa/setup aufrufen" });
    return;
  }

  if (!verifyTotpToken(code, pendingSecret)) {
    res.status(400).json({ message: "Ungültiger Code — bitte erneut versuchen" });
    return;
  }

  storage.setUserTotpSecret(userId, pendingSecret);
  storage.clearUserPendingTotpSecret(userId);
  res.json({ recoveryCodes: storage.generateAndStoreUserRecoveryCodes(userId) });
});

authRouter.post("/2fa/regenerate-recovery", requireStepUp, (req, res) => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ message: "Nicht angemeldet" }); return; }
  res.json({ recoveryCodes: storage.generateAndStoreUserRecoveryCodes(userId) });
});
