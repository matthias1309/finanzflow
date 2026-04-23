import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  accounts, categories, transactions, categoryRules,
  type Account, type InsertAccount,
  type Category, type InsertCategory,
  type Transaction, type InsertTransaction,
  type CategoryRule,
} from "@shared/schema";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IStorage {
  // Accounts
  getAccounts(): Account[];
  getAccount(id: number): Account | undefined;
  createAccount(data: InsertAccount): Account;
  updateAccount(id: number, data: InsertAccount): Account | undefined;
  deleteAccount(id: number): void;
  // Categories
  getCategories(): Category[];
  createCategory(data: InsertCategory): Category;
  updateCategory(id: number, data: InsertCategory): Category | undefined;
  deleteCategory(id: number): void;
  // Transactions
  getTransactions(month?: string, accountId?: number): Transaction[];
  createTransaction(data: InsertTransaction): Transaction;
  createTransactions(data: InsertTransaction[]): Transaction[];
  updateTransaction(id: number, data: Partial<InsertTransaction>): Transaction | undefined;
  deleteTransaction(id: number): void;
  getAvailableMonths(): string[];
  // Category Rules
  getCategoryRules(): CategoryRule[];
  suggestCategory(description: string): number | null;
  learnCategoryRules(entries: { description: string; categoryId: number }[]): void;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export const storage: IStorage = {

  // ── Accounts ──────────────────────────────────────────────────────────────
  getAccounts()            { return db.select().from(accounts).all(); },
  getAccount(id)           { return db.select().from(accounts).where(eq(accounts.id, id)).get(); },
  createAccount(data)      { return db.insert(accounts).values(data).returning().get(); },
  updateAccount(id, data)  { return db.update(accounts).set(data).where(eq(accounts.id, id)).returning().get(); },
  deleteAccount(id)        { db.delete(accounts).where(eq(accounts.id, id)).run(); },

  // ── Categories ────────────────────────────────────────────────────────────
  getCategories()          { return db.select().from(categories).all(); },
  createCategory(data)     { return db.insert(categories).values(data).returning().get(); },
  updateCategory(id, data) { return db.update(categories).set(data).where(eq(categories.id, id)).returning().get(); },
  deleteCategory(id)       { db.delete(categories).where(eq(categories.id, id)).run(); },

  // ── Transactions ──────────────────────────────────────────────────────────
  getTransactions(month?, accountId?) {
    const conditions = [
      month     ? eq(transactions.month,     month)     : null,
      accountId ? eq(transactions.accountId, accountId) : null,
    ].filter(Boolean) as ReturnType<typeof eq>[];

    const query = db.select().from(transactions);
    if (conditions.length === 2) return query.where(and(conditions[0], conditions[1])).all();
    if (conditions.length === 1) return query.where(conditions[0]).all();
    return query.all();
  },

  createTransaction(data)  { return db.insert(transactions).values(data).returning().get(); },
  createTransactions(data) {
    return data.map(d => db.insert(transactions).values(d).returning().get());
  },
  updateTransaction(id, data) {
    return db.update(transactions).set(data).where(eq(transactions.id, id)).returning().get();
  },
  deleteTransaction(id) { db.delete(transactions).where(eq(transactions.id, id)).run(); },

  getAvailableMonths() {
    const rows = db.select({ month: transactions.month }).from(transactions).all();
    return [...new Set(rows.map(r => r.month))].sort().reverse();
  },

  // ── Category Rules ─────────────────────────────────────────────────────────
  getCategoryRules() { return db.select().from(categoryRules).all(); },

  /**
   * Findet die beste Kategorie für eine Beschreibung anhand gespeicherter Keywords.
   * Längeres Keyword gewinnt (spezifischer); bei Gleichstand gewinnt höherer hits-Wert.
   */
  suggestCategory(description: string): number | null {
    const normalized = description.toLowerCase();
    const rules      = db.select().from(categoryRules).all();

    let best: { categoryId: number; keyLen: number; hits: number } | null = null;

    for (const rule of rules) {
      if (!normalized.includes(rule.keyword)) continue;
      const isBetter =
        !best ||
        rule.keyword.length > best.keyLen ||
        (rule.keyword.length === best.keyLen && rule.hits > best.hits);
      if (isBetter) {
        best = { categoryId: rule.categoryId, keyLen: rule.keyword.length, hits: rule.hits };
      }
    }

    return best?.categoryId ?? null;
  },

  /**
   * Lernt aus bestätigten Import-Buchungen:
   * Extrahiert ein normalisiertes Keyword und speichert / aktualisiert die Kategorie.
   */
  learnCategoryRules(entries: { description: string; categoryId: number }[]): void {
    for (const { description, categoryId } of entries) {
      const keyword = extractKeyword(description);
      if (!keyword || keyword.length < 3) continue;

      const existing = db
        .select()
        .from(categoryRules)
        .where(eq(categoryRules.keyword, keyword))
        .get();

      if (existing) {
        db.update(categoryRules)
          .set({ categoryId, hits: existing.hits + 1 })
          .where(eq(categoryRules.keyword, keyword))
          .run();
      } else {
        db.insert(categoryRules).values({ keyword, categoryId, hits: 1 }).run();
      }
    }
  },
};

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/**
 * Extrahiert das relevanteste Keyword aus einer Buchungsbeschreibung.
 * Nimmt den Payee-Namen links vom ersten Trennzeichen " – " / " - ",
 * dann den ersten Token wenn dieser ≥ 4 Zeichen lang ist.
 */
function extractKeyword(description: string): string {
  const normalized = description.toLowerCase().trim();
  const payee      = normalized.split(/ – | - /)[0].trim();
  const firstToken = payee.split(/\s+/)[0];
  return firstToken.length >= 4 ? firstToken : payee.slice(0, 30);
}
