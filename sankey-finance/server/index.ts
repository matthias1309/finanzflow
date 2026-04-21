import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { basicAuthMiddleware } from "./auth";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";

const app        = express();
const httpServer = createServer(app);

// ── Sicherheit ────────────────────────────────────────────────────────────────
app.use(basicAuthMiddleware);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Request-Logging ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

// ── Routen & statische Dateien ────────────────────────────────────────────────
(async () => {
  registerRoutes(httpServer, app);

  // Fehlerbehandlung
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status  = err.status ?? err.statusCode ?? 500;
    const message = err.message ?? "Internal Server Error";
    console.error("Unhandled error:", err);
    if (!res.headersSent) res.status(status).json({ message });
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
