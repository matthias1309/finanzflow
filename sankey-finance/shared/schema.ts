import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Users ───────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id:                integer("id").primaryKey({ autoIncrement: true }),
  username:          text("username").notNull().unique(),
  passwordHash:      text("password_hash").notNull(),
  isAdmin:           integer("is_admin").notNull().default(0),
  totpSecret:        text("totp_secret"),
  totpEnabled:       integer("totp_enabled").notNull().default(0),
  totpPendingSecret: text("totp_pending_secret"),
  totpLastUsedToken: text("totp_last_used_token"),
  createdAt:         text("created_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type PublicUser = Omit<User, "passwordHash" | "totpSecret" | "totpPendingSecret" | "totpLastUsedToken">;

const passwordSchema = z.string().min(8, "Passwort muss mindestens 8 Zeichen haben");

export const createUserSchema = z.object({
  username: z.string().min(1, "Benutzername erforderlich"),
  password: passwordSchema,
  isAdmin:  z.boolean().optional().default(false),
});

export const updateUserSchema = z.object({
  isAdmin: z.boolean(),
});

export const changePasswordSchema = z.object({
  newPassword: passwordSchema,
  oldPassword: z.string().optional(),
});

export type CreateUserInput    = z.infer<typeof createUserSchema>;
export type UpdateUserInput    = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ─── Accounts ────────────────────────────────────────────────
export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),           // e.g. "ING Girokonto", "Tagesgeld", "Mietwohnung Hamburg"
  bank: text("bank").notNull().default("Sonstige"), // "ING" | "DKB" | "N26" | "Sonstige"
  color: text("color").notNull().default("#01696f"),
  type: text("type").notNull().default("checking"), // "checking" | "savings" | "rental"
  iban: text("iban"),
});

// ─── Categories ──────────────────────────────────────────────
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(), // "income" | "expense" | "transfer"
  color: text("color").notNull().default("#01696f"),
});

// ─── Transactions ────────────────────────────────────────────
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  month: text("month").notNull(),           // "2026-04"
  date: text("date"),                       // "2026-04-15" (from PDF)
  description: text("description").notNull(),
  amount: real("amount").notNull(),         // positive = income, negative = expense
  accountId: integer("account_id").notNull(),
  categoryId: integer("category_id"),      // nullable until categorized
  type: text("type").notNull(),             // "income" | "expense" | "transfer"
  transferToAccountId: integer("transfer_to_account_id"), // for transfers between own accounts
  importSource: text("import_source"),     // "manual" | "pdf"
  originalText: text("original_text"),     // raw line from PDF for reference
});

// ─── App Settings (Key-Value für interne Konfiguration) ──────
export const appSettings = sqliteTable("app_settings", {
  key:   text("key").primaryKey(),
  value: text("value").notNull(),
});

// ─── Recovery Codes (2FA Backup-Codes, per User) ─────────────
export const recoveryCodes = sqliteTable("recovery_codes", {
  id:       integer("id").primaryKey({ autoIncrement: true }),
  userId:   integer("user_id"),
  codeHash: text("code_hash").notNull(),
  used:     integer("used").notNull().default(0),
});

// ─── Category Rules (Auto-Kategorisierung) ──────────────────
// Lernende Regeln: keyword → category. Wird beim Bestätigen eines Imports
// automatisch gespeichert und beim nächsten Upload als Vorauswahl genutzt.
export const categoryRules = sqliteTable("category_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keyword: text("keyword").notNull(),       // normalisiertes Keyword (lowercase, getrimmt)
  categoryId: integer("category_id").notNull(),
  hits: integer("hits").notNull().default(1), // wie oft diese Regel bestätigt wurde
});

export const insertCategoryRuleSchema = createInsertSchema(categoryRules).omit({ id: true });
export type InsertCategoryRule = z.infer<typeof insertCategoryRuleSchema>;
export type CategoryRule = typeof categoryRules.$inferSelect;

// ─── Insert schemas ──────────────────────────────────────────
/** Hex-Farbe: #rrggbb oder #rgb */
const hexColorSchema = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Ungültiges Farbformat (erwartet #rrggbb)");

/** IBAN: 2 Buchstaben + 2 Ziffern + bis zu 30 alphanumerische Zeichen, Leerzeichen erlaubt */
const ibanSchema = z.string().regex(/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/, "Ungültige IBAN").nullable().optional();

/** Erlaubte Konto-Typen */
const accountTypeSchema = z.enum(["checking", "savings", "rental", "investment", "cash", "other"]);

/** Erlaubte Kategorie-Typen */
const categoryTypeSchema = z.enum(["income", "expense", "transfer"]);

/** Erlaubte Buchungs-Typen */
const transactionTypeSchema = z.enum(["income", "expense", "transfer"]);

export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true }).extend({
  color: hexColorSchema,
  iban:  ibanSchema,
  type:  accountTypeSchema,
});

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true }).extend({
  color: hexColorSchema,
  type:  categoryTypeSchema,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true }).extend({
  type: transactionTypeSchema,
});

// ─── Types ───────────────────────────────────────────────────
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
