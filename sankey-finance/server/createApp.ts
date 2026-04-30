import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { authRateLimiter, requireAuth } from "./auth";
import { sessionMiddleware } from "./session";
import { securityHeadersMiddleware, csrfProtectionMiddleware } from "./securityHeaders";
import { authRouter } from "./routes/auth";
import { registerRoutes } from "./routes";

export function createApp() {
  const app        = express();
  const httpServer = createServer(app);

  // Uberspace terminates HTTPS at nginx and proxies via HTTP to Node.
  // Without this, req.secure is false and express-session won't set
  // the session cookie (cookie.secure=true requires req.secure=true).
  app.set("trust proxy", 1);

  app.use(securityHeadersMiddleware);
  app.use(sessionMiddleware);
  app.use(authRateLimiter);
  app.use(csrfProtectionMiddleware);

  app.use(express.json({ limit: "200kb" }));
  app.use(express.urlencoded({ extended: false, limit: "200kb" }));

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      if (req.path.startsWith("/api")) {
        const duration = Date.now() - start;
        const safePath = req.path.replace(/[\r\n]/g, "_");
        console.log(`${req.method} ${safePath} ${res.statusCode} in ${duration}ms`);
      }
    });
    next();
  });

  // Öffentliche Auth-Endpunkte — vor requireAuth registrieren
  app.use("/api/auth", authRouter);

  // Session-Authentifizierung für alle anderen /api/*-Routen
  app.use("/api", requireAuth);

  registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status ?? err.statusCode ?? 500;
    console.error("Unhandled error:", err);
    if (!res.headersSent) {
      const message = status < 500
        ? (err.message ?? "Bad Request")
        : "Ein interner Fehler ist aufgetreten.";
      res.status(status).json({ message });
    }
  });

  return { app, httpServer };
}
