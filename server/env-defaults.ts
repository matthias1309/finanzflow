// MUST be imported first, before any other module that uses env vars
// Sets defaults for local development. Never sets fallback values for production or test — a
// fixed secret checked into the repo defeats the point of a secret (GitGuardian flagged exactly
// this: see .claude/rules/learnings.md, "Secrets were committed to the public repo").

import { randomBytes } from "crypto";

const setDefault = (key: string, value: string) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
};

// For local development: NODE_ENV defaults to development if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}
setDefault("PORT", "3000");
setDefault("DB_PATH", "/data/finance.db");
setDefault("APP_ORIGIN", "http://localhost:3000");
setDefault("APP_USER", "admin");
setDefault("TOTP_ISSUER", "FinanzFlow");
setDefault("SESSION_MAX_AGE_HOURS", "8");

// Secret fallbacks: local development only. Production and Docker deployments must set these
// explicitly (see DEPLOYMENT.md) — server/auth.ts fails fast at startup if they are missing.
if (process.env.NODE_ENV === "development") {
  // Fixed, publicly-known dev login (documented) — not a secret, just a convenience credential.
  setDefault("APP_PASSWORD_HASH", "$2b$10$spm5kT4H2O0XB.0nyQPm9ea5yakQN5EaW4aqrBM9Q3ze0qEBPL5GK"); // password: admin
  // Generated fresh per process start — no fixed value to leak, sessions/TOTP simply reset on restart.
  setDefault("SESSION_SECRET", randomBytes(32).toString("hex"));
  setDefault("TOTP_ENCRYPTION_KEY", randomBytes(32).toString("hex"));
}
