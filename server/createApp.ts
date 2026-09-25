import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { requireAuth } from "./auth";
import { sessionMiddleware } from "./session";
import { securityHeadersMiddleware, csrfProtectionMiddleware } from "./securityHeaders";
import { authRouter } from "./routes/auth";
import { registerRoutes } from "./routes";

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  // If a reverse proxy ever terminates HTTPS in front of Node, req.secure
  // would be false and express-session wouldn't set the session cookie
  // (cookie.secure=true requires req.secure=true). Harmless when Node
  // terminates HTTPS itself, as on the Raspberry Pi Docker deployment.
  app.set("trust proxy", 1);

  app.use(securityHeadersMiddleware);
  app.use(sessionMiddleware);
  // authRateLimiter is mounted on POST /api/auth/login only (server/routes/auth.ts). Mounted here
  // globally it counted every failed request (unauthenticated 401s, 404s) as a login attempt and
  // then answered 429 for the whole app, including the SPA shell.
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

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const errObj = err as { status?: number; statusCode?: number; message?: string };
    const status = errObj.status ?? errObj.statusCode ?? 500;
    console.error("Unhandled error:", err);
    if (!res.headersSent) {
      const message =
        status < 500 ? (errObj.message ?? "Bad Request") : "Ein interner Fehler ist aufgetreten.";
      res.status(status).json({ message });
    }
  });

  return { app, httpServer };
}
