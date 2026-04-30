import { type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import rateLimit from "express-rate-limit";

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

// ─── Fail-Secure: Server verweigert Start ohne Passwort ──────────��────────────

const PASSWORD_HASH = process.env.APP_PASSWORD_HASH ?? "";

if (!PASSWORD_HASH && process.env.NODE_ENV === "production") {
  console.error(
    "[FATAL] APP_PASSWORD_HASH ist nicht gesetzt.\n" +
    "        Die App startet im production-Modus nicht ohne Passwortschutz.\n" +
    "        Hash erzeugen: node -e \"const b=require('bcryptjs'); console.log(b.hashSync('DeinPasswort', 10))\"\n" +
    "        Dann APP_PASSWORD_HASH in der supervisord .ini setzen."
  );
  process.exit(1);
}

// ─── Timing-sicherer String-Vergleich ────────────────────────────────────────

export function safeStringEqual(a: string, b: string): boolean {
  const FIXED_LEN = 256;
  const aBuf = Buffer.alloc(FIXED_LEN);
  const bBuf = Buffer.alloc(FIXED_LEN);
  Buffer.from(a).copy(aBuf);
  Buffer.from(b).copy(bBuf);
  const bufEqual = timingSafeEqual(aBuf, bBuf);
  return bufEqual && a.length === b.length;
}

// ─── Session-Auth-Middleware ──────────────────────────────────────────────────
// Ersetzt basicAuthMiddleware. Prüft session.authenticated statt Basic-Auth-Header.
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
