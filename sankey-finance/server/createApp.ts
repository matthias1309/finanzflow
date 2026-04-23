import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { basicAuthMiddleware, authRateLimiter } from "./auth";
import { securityHeadersMiddleware, csrfProtectionMiddleware } from "./securityHeaders";
import { registerRoutes } from "./routes";

export function createApp() {
  const app        = express();
  const httpServer = createServer(app);

  app.use(securityHeadersMiddleware);
  app.use(authRateLimiter);
  app.use(basicAuthMiddleware);
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
