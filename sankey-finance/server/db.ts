import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
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
`);

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
