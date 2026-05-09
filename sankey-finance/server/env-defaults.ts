// MUST be imported first, before any other module that uses env vars
// Sets defaults for development/docker mode

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
setDefault("APP_PASSWORD_HASH", "$2b$10$spm5kT4H2O0XB.0nyQPm9ea5yakQN5EaW4aqrBM9Q3ze0qEBPL5GK");
setDefault("SESSION_SECRET", "b8c4d2e1f7a9c5b3e8d2f1a6c9e4b7d0");
setDefault("TOTP_ENCRYPTION_KEY", "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1");
setDefault("TOTP_ISSUER", "FinanzFlow");
setDefault("SESSION_MAX_AGE_HOURS", "8");
