import helmet from "helmet";
import { type Request, type Response, type NextFunction } from "express";

/**
 * Security-Header-Middleware.
 *
 * Schützt gegen:
 * - XSS: Content-Security-Policy, X-XSS-Protection
 * - Clickjacking: X-Frame-Options (DENY)
 * - MIME-Sniffing: X-Content-Type-Options (nosniff)
 * - Referrer-Leak: Referrer-Policy (strict-origin-when-cross-origin)
 * - HTTPS-Downgrade: Strict-Transport-Security (HSTS)
 */
export const securityHeadersMiddleware = helmet({
  // Content-Security-Policy: nur eigene Ressourcen + inline-styles für Tailwind/shadcn
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'"], // Tailwind benötigt inline styles
      imgSrc:         ["'self'", "data:"],
      fontSrc:        ["'self'"],
      connectSrc:     ["'self'"],
      frameSrc:       ["'none'"],
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
    },
  },
  // Clickjacking-Schutz
  frameguard:         { action: "deny" },
  // MIME-Sniffing verhindern
  noSniff:            true,
  // HSTS: 1 Jahr, kein Subdomains (Uberspace teilt Subdomains)
  strictTransportSecurity: {
    maxAge:             31_536_000,
    includeSubDomains:  false,
  },
  // Referrer nicht an externe Domains leaken
  referrerPolicy:     { policy: "strict-origin-when-cross-origin" },
  // X-Powered-By entfernen (gibt keine Tech-Stack-Infos preis)
  hidePoweredBy:      true,
});

/**
 * CSRF-Schutz für state-ändernde Requests (POST, PUT, PATCH, DELETE).
 *
 * Basic Auth ist CSRF-anfällig weil Browser Credentials automatisch
 * mitsenden. Origin/Referer-Check blockiert Cross-Origin Requests.
 *
 * Erlaubte Origins: APP_ORIGIN (Pflicht in production) oder localhost.
 */
const ALLOWED_ORIGIN = process.env.APP_ORIGIN ?? "";
const SAFE_METHODS   = new Set(["GET", "HEAD", "OPTIONS"]);

export function csrfProtectionMiddleware(
  req:  Request,
  res:  Response,
  next: NextFunction,
): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin  = req.headers["origin"]  ?? "";
  const referer = req.headers["referer"] ?? "";

  // In development: localhost immer erlaubt
  if (process.env.NODE_ENV !== "production") {
    next();
    return;
  }

  if (!ALLOWED_ORIGIN) {
    // Fail-secure: ohne APP_ORIGIN alle Mutations blockieren
    res.status(403).json({ error: "APP_ORIGIN nicht konfiguriert" });
    return;
  }

  const isOriginOk  = origin  && origin.startsWith(ALLOWED_ORIGIN);
  const isRefererOk = referer && referer.startsWith(ALLOWED_ORIGIN);

  if (!isOriginOk && !isRefererOk) {
    res.status(403).json({ error: "CSRF: Ungültiger Origin" });
    return;
  }

  next();
}
