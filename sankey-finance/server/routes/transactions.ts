import { Router } from "express";
import { storage } from "../storage";
import { insertTransactionSchema } from "@shared/schema";

export const transactionsRouter = Router();

transactionsRouter.get("/", (req, res) => {
  const month     = req.query.month     as string | undefined;
  const accountId = req.query.accountId ? parseInt(req.query.accountId as string) : undefined;
  res.json(storage.getTransactions(month, accountId));
});

transactionsRouter.post("/", (req, res) => {
  const parsed = insertTransactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.status(201).json(storage.createTransaction(parsed.data));
});

transactionsRouter.post("/batch", (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "Array erwartet" });
  const valid = req.body
    .map(item => insertTransactionSchema.safeParse(item))
    .filter(r => r.success)
    .map(r => r.data!);
  res.status(201).json(storage.createTransactions(valid));
});

transactionsRouter.patch("/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });
  const tx = storage.updateTransaction(id, req.body);
  if (!tx) return res.status(404).json({ error: "Nicht gefunden" });
  res.json(tx);
});

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
