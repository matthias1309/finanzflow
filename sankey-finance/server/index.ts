import "./env-defaults";
import https from "https";
import { readFileSync } from "fs";
import { createApp } from "./createApp";
import { serveStatic } from "./static";

const { app, httpServer } = createApp();

(async () => {
  // In Docker or production: use pre-built static files
  // In local dev: use Vite with HMR
  const isDocker = process.env.DOCKER_DEPLOY === "true";
  const isProduction = process.env.NODE_ENV === "production";

  if (isDocker || isProduction) {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT ?? "5000", 10);
  const useHttps = process.env.USE_HTTPS === "true";

  if (useHttps) {
    // HTTPS mit Self-Signed Cert (nur in Docker)
    try {
      const cert = readFileSync("/app/certs/cert.pem");
      const key = readFileSync("/app/certs/key.pem");
      https.createServer({ cert, key }, app).listen({ port, host: "0.0.0.0" }, () => {
        console.log(`FinanzFlow läuft auf Port ${port} (HTTPS)`);
      });
    } catch (err) {
      console.error("HTTPS Zertifikate nicht gefunden:", err);
      process.exit(1);
    }
  } else {
    // HTTP (Standard)
    httpServer.listen({ port, host: "0.0.0.0" }, () => {
      console.log(`FinanzFlow läuft auf Port ${port}`);
    });
  }
})();
