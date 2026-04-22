import { type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "crypto";
import rateLimit from "express-rate-limit";

/**
 * Passwort-Hash einmalig generieren:
 *   node -e "const b=require('bcryptjs'); console.log(b.hashSync('MeinPasswort', 10))"
 * Den Hash als APP_PASSWORD_HASH in der supervisord .ini setzen.
 * In supervisord müssen $ als $$ escaped werden (je nach Version).
 */
const PASSWORD_HASH = process.env.APP_PASSWORD_HASH ?? "";
const APP_USER      = process.env.APP_USER ?? "admin";

// ─── Brute-Force-Schutz ──────────────────────────────────────────────────────
// Max. 10 fehlgeschlagene Login-Versuche pro IP in 15 Minuten.
// Bei Überschreitung: 429 Too Many Requests für weitere 15 Minuten.
export const authRateLimiter = rateLimit({
  windowMs:         15 * 60 * 1000, // 15 Minuten
  max:              10,              // max. Versuche pro Fenster
  standardHeaders:  true,
  legacyHeaders:    false,
  skipSuccessfulRequests: true,      // Zähler nur bei 401 erhöhen
  message:          { error: "Zu viele Login-Versuche. Bitte in 15 Minuten erneut versuchen." },
  keyGenerator:     (req) => req.ip ?? "unknown",
});

// ─── Fail-Secure: Server verweigert Start ohne Passwort ───────────────────────
// Eine Finanz-App ohne Passwortschutz ist inakzeptabel.
// Einzige Ausnahme: lokale Entwicklung (NODE_ENV !== "production").
if (!PASSWORD_HASH && process.env.NODE_ENV === "production") {
  console.error(
    "[FATAL] APP_PASSWORD_HASH ist nicht gesetzt.\n" +
    "        Die App startet im production-Modus nicht ohne Passwortschutz.\n" +
    "        Hash erzeugen: node -e \"const b=require('bcryptjs'); console.log(b.hashSync('DeinPasswort', 10))\"\n" +
    "        Dann APP_PASSWORD_HASH in der supervisord .ini setzen."
  );
  process.exit(1);
}

/**
 * Vergleicht zwei Strings timing-sicher (verhindert Timing-Attacks auf den Benutzernamen).
 * bcrypt.compareSync() ist bereits timing-sicher für den Passwort-Teil.
 */
function safeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Basic-Auth-Middleware.
 * - Production ohne Hash: Server startet gar nicht (siehe oben).
 * - Development ohne Hash: Middleware durchgelassen (kein Schutz, aber kein Blocker).
 * - Mit Hash: Benutzername timing-sicher, Passwort via bcrypt.
 */
export function basicAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!PASSWORD_HASH) {
    // Nur erreichbar in development (NODE_ENV !== "production")
    next();
    return;
  }

  const authHeader = req.headers["authorization"] ?? "";

  if (authHeader.startsWith("Basic ")) {
    const decoded  = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx !== -1) {
      const user = decoded.slice(0, colonIdx);
      const pass = decoded.slice(colonIdx + 1);
      if (safeStringEqual(user, APP_USER) && bcrypt.compareSync(pass, PASSWORD_HASH)) {
        next();
        return;
      }
    }
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="FinanzFlow"');
  res.status(401).send("Zugang verweigert");
}
