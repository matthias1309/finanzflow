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

// ─── Fail-Secure: Server verweigert Start bei fehlenden Pflicht-Variablen ────

const PASSWORD_HASH = process.env.APP_PASSWORD_HASH ?? "";

if (process.env.NODE_ENV === "production") {
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
