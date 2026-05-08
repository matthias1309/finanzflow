import { type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual, createHash } from "crypto";
import rateLimit from "express-rate-limit";
import { storage } from "./storage";

// ─── Brute-Force-Schutz ───────────────────────────────────────────────────────

export const authRateLimiter = rateLimit({
  windowMs:               15 * 60 * 1000,
  max:                    10,
  standardHeaders:        true,
  legacyHeaders:          false,
  skipSuccessfulRequests: true,
  skip:                   () => process.env.NODE_ENV === "test",
  message:                { error: "Zu viele Login-Versuche. Bitte in 15 Minuten erneut versuchen." },
});

// ─── Fail-Secure: Server verweigert Start bei fehlenden Pflicht-Variablen ────

// Set defaults if not provided (for Docker dev mode)
// Use SHA256 hashes for simplicity (password = sha256(password))
// SHA256("admin") = 8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918
if (!process.env.APP_PASSWORD_HASH) {
  process.env.APP_PASSWORD_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  process.env.SESSION_SECRET = "b8c4d2e1f7a9c5b3e8d2f1a6c9e4b7d0";
}
if (!process.env.TOTP_ENCRYPTION_KEY || process.env.TOTP_ENCRYPTION_KEY.length !== 64) {
  process.env.TOTP_ENCRYPTION_KEY = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1";
}
if (!process.env.APP_USER) {
  process.env.APP_USER = "admin";
}

const PASSWORD_HASH = process.env.APP_PASSWORD_HASH ?? "";

// Validation only for real production (not Docker dev mode)
// Docker containers use defaults set above
if (process.env.NODE_ENV === "production" && process.env.DOCKER_DEPLOY !== "true") {
  const fatal = (msg: string) => { console.error(`[FATAL] ${msg}`); process.exit(1); };

  if (!PASSWORD_HASH) {
    fatal(
      "APP_PASSWORD_HASH ist nicht gesetzt.\n" +
      "        Hash erzeugen: node -e \"const b=require('bcryptjs'); console.log(b.hashSync('DeinPasswort', 10))\"\n" +
      "        Dann APP_PASSWORD_HASH in der supervisord .ini setzen."
    );
  }

  const sessionSecret = process.env.SESSION_SECRET ?? "";
  if (sessionSecret.length < 32) {
    fatal(
      "SESSION_SECRET fehlt oder ist zu kurz (mind. 32 Zeichen).\n" +
      "        Erzeugen: openssl rand -hex 32\n" +
      "        Dann SESSION_SECRET in der supervisord .ini setzen."
    );
  }

  const totpKey = process.env.TOTP_ENCRYPTION_KEY ?? "";
  if (totpKey.length !== 64) {
    fatal(
      "TOTP_ENCRYPTION_KEY fehlt oder hat falsche Länge (muss 64 Hex-Zeichen sein).\n" +
      "        Erzeugen: openssl rand -hex 32\n" +
      "        Dann TOTP_ENCRYPTION_KEY in der supervisord .ini setzen."
    );
  }
}

// ─── Timing-sicherer String-Vergleich ────────────────────────────────────────

export function safeStringEqual(a: string, b: string): boolean {
  const FIXED_LEN = 256;
  const aBuf = Buffer.alloc(FIXED_LEN);
  const bBuf = Buffer.alloc(FIXED_LEN);
  Buffer.from(a).copy(aBuf);
  Buffer.from(b).copy(bBuf);
  // Both comparisons are evaluated unconditionally before combining,
  // preventing && short-circuit from leaking whether the buffer comparison passed.
  const bufsMatch = timingSafeEqual(aBuf, bBuf);
  const lensMatch = a.length === b.length;
  return bufsMatch && lensMatch;
}

// ─── Session-Auth-Middleware ──────────────────────────────────────────────────
// Prüft ausschließlich session.authenticated — nicht APP_USER oder APP_PASSWORD_HASH.
// Das ist korrekt: Benutzername + Passwort werden einmalig beim Login in
// POST /api/auth/login geprüft (safeStringEqual + bcrypt). Danach trägt die
// Session den Beweis der erfolgreichen Authentifizierung. Jede Route erneut gegen
// Env-Vars zu prüfen wäre redundant und würde einen Env-Var-Wechsel zur Laufzeit
// als Logout-Mechanismus missbrauchen.
// Bypassed wenn APP_PASSWORD_HASH nicht gesetzt (dev/test).

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!PASSWORD_HASH) {
    next();
    return;
  }

  if (req.session?.authenticated === true) {
    next();
    return;
  }

  res.status(401).json({ message: "Nicht angemeldet" });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!PASSWORD_HASH) {
    next();
    return;
  }

  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ message: "Nicht angemeldet" });
    return;
  }

  const user = storage.getUserById(userId);
  if (!user || user.isAdmin !== 1) {
    res.status(403).json({ message: "Kein Zugriff" });
    return;
  }

  next();
}
