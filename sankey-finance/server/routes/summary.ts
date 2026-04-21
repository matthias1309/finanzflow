import { Router } from "express";
import { storage } from "../storage";
import type { Account, Category } from "@shared/schema";

export const summaryRouter = Router();

// ─── Typen ────────────────────────────────────────────────────────────────────

interface CategoryTotal {
  name:  string;
  color: string;
  total: number;
}

interface AccountSummary {
  account:            Account;
  totalIncome:        number;
  totalExpenses:      number;
  incomeByCategory:   Record<number, CategoryTotal>;
  expenseByCategory:  Record<number, CategoryTotal>;
  /** toAccountId → Betrag */
  transfersOut:       Record<number, number>;
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * Gibt eine monatsweise Zusammenfassung aller Konten zurück,
 * strukturiert für das Sankey-Diagramm.
 */
summaryRouter.get("/:month", (req, res) => {
  const { month } = req.params;

  const txs  = storage.getTransactions(month);
  const cats = storage.getCategories();
  const accs = storage.getAccounts();

  const catMap = buildMap(cats, c => c.id);
  const accountSummaries = buildAccountSummaries(accs, txs, catMap);

  const totalIncome   = sumField(Object.values(accountSummaries), s => s.totalIncome);
  const totalExpenses = sumField(Object.values(accountSummaries), s => s.totalExpenses);

  res.json({ totalIncome, totalExpenses, accountSummaries, accounts: accs, categories: cats, transactions: txs });
});

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function buildMap<T>(items: T[], keyFn: (item: T) => number): Record<number, T> {
  return Object.fromEntries(items.map(i => [keyFn(i), i]));
}

function sumField<T>(items: T[], fn: (item: T) => number): number {
  return items.reduce((acc, item) => acc + fn(item), 0);
}

function buildAccountSummaries(
  accs:   Account[],
  txs:    ReturnType<typeof storage.getTransactions>,
  catMap: Record<number, Category>,
): Record<number, AccountSummary> {
  const summaries: Record<number, AccountSummary> = {};

  for (const acc of accs) {
    summaries[acc.id] = {
      account:           acc,
      totalIncome:       0,
      totalExpenses:     0,
      incomeByCategory:  {},
      expenseByCategory: {},
      transfersOut:      {},
    };
  }

  for (const tx of txs) {
    const summary = summaries[tx.accountId];
    if (!summary) continue;

    if (tx.type === "transfer" && tx.transferToAccountId) {
      const amount = Math.abs(tx.amount);
      summary.transfersOut[tx.transferToAccountId] =
        (summary.transfersOut[tx.transferToAccountId] ?? 0) + amount;
      continue;
    }

    const cat      = tx.categoryId ? catMap[tx.categoryId] : null;
    const catId    = tx.categoryId ?? -1;
    const catName  = cat?.name  ?? "Unkategorisiert";
    const catColor = cat?.color ?? "#7a7974";

    if (tx.type === "income") {
      summary.totalIncome += tx.amount;
      addToCategory(summary.incomeByCategory, catId, catName, catColor, tx.amount);
    } else {
      const abs = Math.abs(tx.amount);
      summary.totalExpenses += abs;
      addToCategory(summary.expenseByCategory, catId, catName, catColor, abs);
    }
  }

  return summaries;
}

function addToCategory(
  map:   Record<number, CategoryTotal>,
  id:    number,
  name:  string,
  color: string,
  amount: number,
): void {
  if (!map[id]) map[id] = { name, color, total: 0 };
  map[id].total += amount;
}
