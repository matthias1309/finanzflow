import { type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "crypto";
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

const PASSWORD_HASH = process.env.APP_PASSWORD_HASH ?? "";

if (process.env.NODE_ENV === "production") {
  const fatal = (msg: string) => { console.error(`[FATAL] ${msg}`); process.exit(1); };

  if (!process.env.APP_USER) {
    fatal(
      "APP_USER ist nicht gesetzt.\n" +
      "        Benutzernamen in der supervisord .ini setzen."
    );
  }

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
