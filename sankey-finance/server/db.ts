import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import { categories } from "@shared/schema";

// DB_PATH kann per Umgebungsvariable überschrieben werden (z.B. Uberspace-Deployment).
const DB_PATH = process.env.DB_PATH ?? "finance.db";

const sqlite = new Database(DB_PATH);
sqlite.pragma("foreign_keys = ON");
export const db = drizzle(sqlite);

// ─── Schema-Migration ────────────────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    name    TEXT    NOT NULL,
    bank    TEXT    NOT NULL DEFAULT 'Sonstige',
    color   TEXT    NOT NULL DEFAULT '#01696f',
    type    TEXT    NOT NULL DEFAULT 'checking',
    iban    TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT    NOT NULL,
    type  TEXT    NOT NULL,
    color TEXT    NOT NULL DEFAULT '#01696f'
  );

  CREATE TABLE IF NOT EXISTS category_rules (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword     TEXT    NOT NULL UNIQUE,
    category_id INTEGER NOT NULL,
    hits        INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    month                  TEXT    NOT NULL,
    date                   TEXT,
    description            TEXT    NOT NULL,
    amount                 REAL    NOT NULL,
    account_id             INTEGER NOT NULL,
    category_id            INTEGER,
    type                   TEXT    NOT NULL,
    transfer_to_account_id INTEGER,
    import_source          TEXT,
    original_text          TEXT
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recovery_codes (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    code_hash TEXT    NOT NULL,
    used      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS users (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    username             TEXT    NOT NULL UNIQUE,
    password_hash        TEXT    NOT NULL,
    is_admin             INTEGER NOT NULL DEFAULT 0,
    totp_secret          TEXT,
    totp_enabled         INTEGER NOT NULL DEFAULT 0,
    totp_pending_secret  TEXT,
    totp_last_used_token TEXT,
    created_at           TEXT    NOT NULL
  );
`);

// ─── Spalten-Migrationen (idempotent) ─────────────────────────────────────────
function tryExec(sql: string): void {
  try { sqlite.exec(sql); } catch { /* Spalte existiert bereits */ }
}
tryExec("ALTER TABLE recovery_codes ADD COLUMN user_id INTEGER");

// ─── Admin-User Seeding (ENV-Sync bei jedem Start) ────────────────────────────
const seedUsername = process.env.APP_USER ?? "";
const seedHash     = process.env.APP_PASSWORD_HASH ?? "";

if (seedUsername && seedHash) {
  const existingUser = sqlite.prepare("SELECT id FROM users WHERE username = ?").get(seedUsername) as { id: number } | undefined;

  if (existingUser) {
    sqlite.prepare("UPDATE users SET password_hash = ?, is_admin = 1 WHERE username = ?")
      .run(seedHash, seedUsername);
  } else {
    sqlite.prepare(
      "INSERT INTO users (username, password_hash, is_admin, totp_enabled, created_at) VALUES (?, ?, 1, 0, ?)"
    ).run(seedUsername, seedHash, new Date().toISOString());
  }

  // ─── TOTP-Datenmigration: app_settings → users (einmalig) ──────────────────
  const adminRow = sqlite.prepare("SELECT id FROM users WHERE username = ?").get(seedUsername) as { id: number } | undefined;
  if (adminRow) {
    const totpSecret = sqlite.prepare("SELECT value FROM app_settings WHERE key = 'totp_secret'").get() as { value: string } | undefined;
    const totpConfigured = sqlite.prepare("SELECT value FROM app_settings WHERE key = 'totp_configured'").get() as { value: string } | undefined;

    if (totpSecret && totpConfigured?.value === "true") {
      const userAlreadyHasTotp = sqlite.prepare("SELECT totp_secret FROM users WHERE id = ?").get(adminRow.id) as { totp_secret: string | null } | undefined;
      if (!userAlreadyHasTotp?.totp_secret) {
        const lastUsedToken = sqlite.prepare("SELECT value FROM app_settings WHERE key = 'totp_last_used_token'").get() as { value: string } | undefined;
        sqlite.prepare("UPDATE users SET totp_secret = ?, totp_enabled = 1, totp_last_used_token = ? WHERE id = ?")
          .run(totpSecret.value, lastUsedToken?.value ?? null, adminRow.id);

        sqlite.prepare("UPDATE recovery_codes SET user_id = ? WHERE user_id IS NULL").run(adminRow.id);

        sqlite.prepare("DELETE FROM app_settings WHERE key IN ('totp_secret', 'totp_configured', 'totp_last_used_token', 'totp_pending_secret')").run();
      }
    }
  }
}

// ─── Standard-Kategorien (einmaliges Seeding) ─────────────────────────────────
const existingCategories = db.select().from(categories).all();
if (existingCategories.length === 0) {
  const defaults = [
    { name: "Gehalt",              type: "income",  color: "#437a22" },
    { name: "Nebeneinkommen",      type: "income",  color: "#6daa45" },
    { name: "Mieteinnahmen",       type: "income",  color: "#4f98a3" },
    { name: "Kapitalerträge",      type: "income",  color: "#7a39bb" },
    { name: "Sonstiges Einkommen", type: "income",  color: "#2a9d8f" },
    { name: "Wohnen & Nebenkosten",type: "expense", color: "#a12c7b" },
    { name: "Lebensmittel",        type: "expense", color: "#da7101" },
    { name: "Transport & Auto",    type: "expense", color: "#964219" },
    { name: "Versicherungen",      type: "expense", color: "#006494" },
    { name: "Freizeit & Sport",    type: "expense", color: "#d19900" },
    { name: "Gesundheit",          type: "expense", color: "#a13544" },
    { name: "Sparen & Investments",type: "expense", color: "#437a22" },
    { name: "Sonstige Ausgaben",   type: "expense", color: "#7a7974" },
    { name: "Kontoübertrag",       type: "transfer",color: "#4f98a3" },
  ] as const;

  for (const cat of defaults) {
    db.insert(categories).values(cat).run();
  }
}
