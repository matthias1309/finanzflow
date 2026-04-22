import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { storage } from "../storage";
import { insertTransactionSchema } from "@shared/schema";

/** Max. 20 Batch-Imports pro IP in 15 Minuten */
const batchRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: "Zu viele Batch-Requests. Bitte in 15 Minuten erneut versuchen." },
  keyGenerator: (req) => req.ip ?? "unknown",
});

export const transactionsRouter = Router();

// ─── Validierungs-Schemas ──────────────────────────────────────────────────────

/** YYYY-MM — kein beliebiger String an die DB weitergeben */
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Ungültiges Monatsformat (erwartet YYYY-MM)");

/** Für PATCH: alle Felder optional, aber nur bekannte Felder erlaubt */
const patchTransactionSchema = insertTransactionSchema.partial();

// ─── Routes ───────────────────────────────────────────────────────────────────

transactionsRouter.get("/", (req, res) => {
  if (req.query.month) {
    const parsed = monthSchema.safeParse(req.query.month);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  }
  const month     = req.query.month as string | undefined;
  const accountId = req.query.accountId ? parseInt(req.query.accountId as string) : undefined;
  if (accountId !== undefined && isNaN(accountId)) {
    return res.status(400).json({ error: "Ungültige accountId" });
  }
  res.json(storage.getTransactions(month, accountId));
});

transactionsRouter.post("/", (req, res) => {
  const parsed = insertTransactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.status(201).json(storage.createTransaction(parsed.data));
});

transactionsRouter.post("/batch", batchRateLimiter, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "Array erwartet" });
  if (req.body.length > 500) return res.status(400).json({ error: "Maximal 500 Transaktionen pro Request" });

  const results = req.body.map((item, idx) => ({
    idx,
    result: insertTransactionSchema.safeParse(item),
  }));

  const valid   = results.filter(r => r.result.success).map(r => r.result.data!);
  const invalid = results.filter(r => !r.result.success).map(r => ({
    idx:    r.idx,
    errors: (r.result as any).error.flatten(),
  }));

  const created = storage.createTransactions(valid);
  res.status(201).json({ created, skipped: invalid.length, errors: invalid });
});

/** PATCH: Partial-Update — nur bekannte Felder, Schema-validiert */
transactionsRouter.patch("/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });

  const parsed = patchTransactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const tx = storage.updateTransaction(id, parsed.data);
  if (!tx) return res.status(404).json({ error: "Nicht gefunden" });
  res.json(tx);
});

/** PUT: vollständiges Ersetzen */
transactionsRouter.put("/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });

  const parsed = insertTransactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const tx = storage.updateTransaction(id, parsed.data);
  if (!tx) return res.status(404).json({ error: "Nicht gefunden" });
  res.json(tx);
});

transactionsRouter.delete("/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });
  storage.deleteTransaction(id);
  res.json({ ok: true });
});
