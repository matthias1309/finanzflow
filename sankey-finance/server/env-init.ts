// Set default environment variables if missing (for Docker dev mode)
// This must be called BEFORE importing modules that depend on these variables

if (!process.env.APP_PASSWORD_HASH || process.env.APP_PASSWORD_HASH.length < 20) {
  process.env.APP_PASSWORD_HASH = "$2b$10$spm5kT4H2O0XB.0nyQPm9ea5yakQN5EaW4aqrBM9Q3ze0qEBPL5GK"; // password: admin
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  process.env.SESSION_SECRET = "b8c4d2e1f7a9c5b3e8d2f1a6c9e4b7d0"; // dev only
}

if (!process.env.TOTP_ENCRYPTION_KEY || process.env.TOTP_ENCRYPTION_KEY.length !== 64) {
  process.env.TOTP_ENCRYPTION_KEY = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1"; // dev only
}

if (!process.env.APP_USER) {
  process.env.APP_USER = "admin";
}

if (!process.env.APP_ORIGIN) {
  process.env.APP_ORIGIN = "http://localhost:3000";
}
