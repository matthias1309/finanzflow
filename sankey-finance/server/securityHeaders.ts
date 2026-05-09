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
const isDev = process.env.NODE_ENV !== "production";
const isDockerDeploy = process.env.DOCKER_DEPLOY === "true";
const isRealProduction = !isDockerDeploy && process.env.NODE_ENV === "production";

// In development Vite needs 'unsafe-inline' + 'unsafe-eval' for React Fast Refresh
// In Docker: allow Google Fonts (needed for app)
// In real production: very strict
const cspDirectives = isDev
  ? {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:"],
      connectSrc:  ["'self'", "ws://localhost:*"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
    }
  : isDockerDeploy
  ? {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:"],
      connectSrc:  ["'self'"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
    }
  : {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", "data:"],
      fontSrc:     ["'self'"],
      connectSrc:  ["'self'"],
      frameSrc:    ["'none'"],
      objectSrc:   ["'none'"],
      baseUri:     ["'self'"],
      formAction:  ["'self'"],
    };

// HSTS nur in echter Production (HTTPS), nicht in Docker über HTTP
const useHSTS = !isDockerDeploy && process.env.NODE_ENV === "production";

export const securityHeadersMiddleware = helmet({
  contentSecurityPolicy: {
    directives: cspDirectives,
    // Kein upgrade-insecure-requests in Docker (HTTP Deployments)
    reportOnly: false,
  },
  // Clickjacking-Schutz
  frameguard:         { action: "deny" },
  // MIME-Sniffing verhindern
  noSniff:            true,
  // HSTS: 1 Jahr, kein Subdomains (Uberspace teilt Subdomains)
  // Aber nur für echte HTTPS-Deployments, nicht für Docker über HTTP
  strictTransportSecurity: useHSTS
    ? { maxAge: 31_536_000, includeSubDomains: false }
    : false,
  // Referrer-Policy anpassen für Docker (nicht so streng)
  referrerPolicy: isDockerDeploy
    ? { policy: "no-referrer-when-downgrade" }
    : { policy: "strict-origin-when-cross-origin" },
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

/**
 * Vergleicht den Origin einer URL exakt gegen einen erlaubten Origin.
 * Verwendet new URL() um Bypass via Subdomain-Tricks zu verhindern:
 *   startsWith("https://example.com") würde auch
 *   "https://example.com.evil.com" akzeptieren.
 */
function safeOriginMatch(headerValue: string, allowedOrigin: string): boolean {
  try {
    const parsed = new URL(headerValue);
    return parsed.origin === allowedOrigin;
  } catch {
    // Ungültige URL → ablehnen
    return false;
  }
}

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

  // URL-Parsing statt startsWith() — verhindert Bypass via https://example.com.evil.com
  const isOriginOk  = origin  && safeOriginMatch(origin,  ALLOWED_ORIGIN);
  const isRefererOk = referer && safeOriginMatch(referer, ALLOWED_ORIGIN);

  if (!isOriginOk && !isRefererOk) {
    res.status(403).json({ error: "CSRF: Ungültiger Origin" });
    return;
  }

  next();
}
