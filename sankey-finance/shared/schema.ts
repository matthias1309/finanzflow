import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
const accountTypeSchema = z.enum(["checking", "savings", "rental", "investment", "cash"]);

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
