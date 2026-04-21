import { Router } from "express";
import { storage } from "../storage";
import { insertAccountSchema } from "@shared/schema";

export const accountsRouter = Router();

accountsRouter.get("/", (_req, res) => {
  res.json(storage.getAccounts());
});

accountsRouter.post("/", (req, res) => {
  const parsed = insertAccountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.status(201).json(storage.createAccount(parsed.data));
});

accountsRouter.put("/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });
  const parsed = insertAccountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const account = storage.updateAccount(id, parsed.data);
  if (!account) return res.status(404).json({ error: "Nicht gefunden" });
  res.json(account);
});

accountsRouter.delete("/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });
  storage.deleteAccount(id);
  res.json({ ok: true });
});
