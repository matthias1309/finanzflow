// Runs before any module is evaluated in this process (pool: 'forks' guarantees a fresh process).
// db.ts reads DB_PATH at import time — set it here to get an isolated in-memory DB per test file.
process.env.DB_PATH   = ":memory:";
process.env.NODE_ENV  = "test";
// Suppress bcrypt production check — no password hash needed in tests (auth bypassed in non-prod).
process.env.APP_PASSWORD_HASH = "";
