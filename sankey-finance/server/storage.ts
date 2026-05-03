import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "./db";
import {
  accounts, categories, transactions, categoryRules, recoveryCodes, users,
  type Account, type InsertAccount,
  type Category, type InsertCategory,
  type Transaction, type InsertTransaction,
  type CategoryRule,
  type User,
} from "@shared/schema";
import { encryptSecret, decryptSecret, generateRecoveryCodePlaintext } from "./totp";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IStorage {
  // Users
  getUsers(): User[];
  getUserById(id: number): User | undefined;
  getUserByUsername(username: string): User | undefined;
  createUser(data: { username: string; passwordHash: string; isAdmin?: number }): User;
  updateUser(id: number, data: { isAdmin: number }): User | undefined;
  updateUserPassword(id: number, passwordHash: string): void;
  deleteUser(id: number): void;
  countAdmins(): number;
  // Per-User TOTP
  getUserTotpConfigured(userId: number): boolean;
  getUserTotpSecret(userId: number): string | null;
  setUserTotpSecret(userId: number, plainSecret: string): void;
  getUserPendingTotpSecret(userId: number): string | null;
  setUserPendingTotpSecret(userId: number, plainSecret: string): void;
  clearUserPendingTotpSecret(userId: number): void;
  getUserTotpLastUsedToken(userId: number): string | null;
  setUserTotpLastUsedToken(userId: number, token: string): void;
  resetUserTotp(userId: number): void;
  // Per-User Recovery Codes
  generateAndStoreUserRecoveryCodes(userId: number): string[];
  verifyAndConsumeUserRecoveryCode(userId: number, code: string): boolean;
  getUserRecoveryCodesRemaining(userId: number): number;
  clearUserRecoveryCodes(userId: number): void;
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

  // ── Users ─────────────────────────────────────────────────────────────────
  getUsers() { return db.select().from(users).all(); },
  getUserById(id) { return db.select().from(users).where(eq(users.id, id)).get(); },
  getUserByUsername(username) { return db.select().from(users).where(eq(users.username, username)).get(); },

  createUser({ username, passwordHash, isAdmin = 0 }) {
    return db.insert(users).values({
      username, passwordHash, isAdmin,
      totpEnabled: 0,
      createdAt: new Date().toISOString(),
    }).returning().get();
  },

  updateUser(id, data) {
    return db.update(users).set(data).where(eq(users.id, id)).returning().get();
  },

  updateUserPassword(id, passwordHash) {
    db.update(users).set({ passwordHash }).where(eq(users.id, id)).run();
  },

  deleteUser(id) { db.delete(users).where(eq(users.id, id)).run(); },

  countAdmins() {
    return db.select().from(users).where(eq(users.isAdmin, 1)).all().length;
  },

  // ── Per-User TOTP ──────────────────────────────────────────────────────────
  getUserTotpConfigured(userId) {
    return db.select().from(users).where(eq(users.id, userId)).get()?.totpEnabled === 1;
  },

  getUserTotpSecret(userId) {
    const enc = db.select().from(users).where(eq(users.id, userId)).get()?.totpSecret;
    if (!enc) return null;
    return decryptSecret(enc);
  },

  setUserTotpSecret(userId, plainSecret) {
    db.update(users).set({ totpSecret: encryptSecret(plainSecret), totpEnabled: 1 }).where(eq(users.id, userId)).run();
  },

  getUserPendingTotpSecret(userId) {
    const enc = db.select().from(users).where(eq(users.id, userId)).get()?.totpPendingSecret;
    if (!enc) return null;
    return decryptSecret(enc);
  },

  setUserPendingTotpSecret(userId, plainSecret) {
    db.update(users).set({ totpPendingSecret: encryptSecret(plainSecret) }).where(eq(users.id, userId)).run();
  },

  clearUserPendingTotpSecret(userId) {
    db.update(users).set({ totpPendingSecret: null }).where(eq(users.id, userId)).run();
  },

  getUserTotpLastUsedToken(userId) {
    return db.select().from(users).where(eq(users.id, userId)).get()?.totpLastUsedToken ?? null;
  },

  setUserTotpLastUsedToken(userId, token) {
    db.update(users).set({ totpLastUsedToken: token }).where(eq(users.id, userId)).run();
  },

  resetUserTotp(userId) {
    db.update(users).set({
      totpSecret: null, totpEnabled: 0, totpPendingSecret: null, totpLastUsedToken: null,
    }).where(eq(users.id, userId)).run();
    db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId)).run();
  },

  // ── Per-User Recovery Codes ────────────────────────────────────────────────
  generateAndStoreUserRecoveryCodes(userId) {
    db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId)).run();
    const plainCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const plain = generateRecoveryCodePlaintext();
      db.insert(recoveryCodes).values({ userId, codeHash: bcrypt.hashSync(plain, 10), used: 0 }).run();
      plainCodes.push(plain);
    }
    return plainCodes;
  },

  verifyAndConsumeUserRecoveryCode(userId, code) {
    const unused = db.select().from(recoveryCodes)
      .where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.used, 0)))
      .all();
    for (const row of unused) {
      if (bcrypt.compareSync(code, row.codeHash)) {
        db.update(recoveryCodes).set({ used: 1 }).where(eq(recoveryCodes.id, row.id)).run();
        return true;
      }
    }
    return false;
  },

  getUserRecoveryCodesRemaining(userId) {
    return db.select().from(recoveryCodes)
      .where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.used, 0)))
      .all().length;
  },

  clearUserRecoveryCodes(userId) {
    db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId)).run();
  },

  // ── Accounts ───────────────────────────────────────────────────���──────────
  getAccounts()            { return db.select().from(accounts).all(); },
  getAccount(id)           { return db.select().from(accounts).where(eq(accounts.id, id)).get(); },
  createAccount(data)      { return db.insert(accounts).values(data).returning().get(); },
  updateAccount(id, data)  { return db.update(accounts).set(data).where(eq(accounts.id, id)).returning().get(); },
  deleteAccount(id)        { db.delete(accounts).where(eq(accounts.id, id)).run(); },

  // ── Categories ──────────────────────────────────────────��─────────────────
  getCategories()          { return db.select().from(categories).all(); },
  createCategory(data)     { return db.insert(categories).values(data).returning().get(); },
  updateCategory(id, data) { return db.update(categories).set(data).where(eq(categories.id, id)).returning().get(); },
  deleteCategory(id)       { db.delete(categories).where(eq(categories.id, id)).run(); },

  // ── Transactions ────────────────────────────���─────────────────────────────
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

  // ── Category Rules ────────────────────────��─────────────────────────���──────
  getCategoryRules() { return db.select().from(categoryRules).all(); },

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

function extractKeyword(description: string): string {
  const normalized = description.toLowerCase().trim();
  const payee      = normalized.split(/ – | - /)[0].trim();
  const firstToken = payee.split(/\s+/)[0];
  return firstToken.length >= 4 ? firstToken : payee.slice(0, 30);
}
