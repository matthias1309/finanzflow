import { type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";

/**
 * Erstellt einen bcrypt-Hash für ein Klartext-Passwort.
 * Verwendung einmalig auf der Kommandozeile:
 *   node -e "const b=require('bcryptjs'); console.log(b.hashSync('MeinPasswort', 10))"
 * Den Hash dann als APP_PASSWORD_HASH in der supervisord .ini setzen.
 */

const PASSWORD_HASH = process.env.APP_PASSWORD_HASH ?? "";
const APP_USER     = process.env.APP_USER ?? "admin";

/**
 * Basic-Auth-Middleware. Nur aktiv wenn APP_PASSWORD_HASH gesetzt ist.
 * Vergleicht das eingegebene Passwort gegen den gespeicherten bcrypt-Hash —
 * das Klartext-Passwort wird nie persistent gespeichert.
 */
export function basicAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!PASSWORD_HASH) {
    // Kein Passwort konfiguriert → kein Schutz (opt-in)
    next();
    return;
  }

  const authHeader = req.headers["authorization"] ?? "";

  if (authHeader.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx !== -1) {
      const user = decoded.slice(0, colonIdx);
      const pass = decoded.slice(colonIdx + 1);
      if (user === APP_USER && bcrypt.compareSync(pass, PASSWORD_HASH)) {
        next();
        return;
      }
    }
  }

  res.setHeader("WWW-Authenticate", 'Basic realm="FinanzFlow"');
  res.status(401).send("Zugang verweigert");
}
