import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { basicAuthMiddleware, authRateLimiter } from "./auth";
import { securityHeadersMiddleware, csrfProtectionMiddleware } from "./securityHeaders";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";

const app        = express();
const httpServer = createServer(app);

// ── Sicherheit ────────────────────────────────────────────────────────────────
app.use(securityHeadersMiddleware);      // HTTP Security-Header (helmet)
app.use(authRateLimiter);               // Brute-Force-Schutz (10 Versuche / 15 min)
app.use(basicAuthMiddleware);            // Basic Auth (bcrypt)
app.use(csrfProtectionMiddleware);       // CSRF Origin/Referer-Check

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Request-Logging ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      const duration = Date.now() - start;
      // Newlines aus req.path entfernen — verhindert Log-Injection via \r\n
      const safePath = req.path.replace(/[\r\n]/g, "_");
      console.log(`${req.method} ${safePath} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

// ── Routen & statische Dateien ────────────────────────────────────────────────
(async () => {
  registerRoutes(httpServer, app);

  // Fehlerbehandlung
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status ?? err.statusCode ?? 500;
    // Interne Details nur ins Server-Log, niemals an den Client
    console.error("Unhandled error:", err);
    if (!res.headersSent) {
      // 4xx: Fehlermeldung kann an Client gehen (validerungsfehler etc.)
      // 5xx: Generische Meldung — kein Leak von Pfaden, Stack-Traces oder Systeminfos
      const message = status < 500
        ? (err.message ?? "Bad Request")
        : "Ein interner Fehler ist aufgetreten.";
      res.status(status).json({ message });
    }
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT ?? "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    console.log(`FinanzFlow läuft auf Port ${port}`);
  });
})();
