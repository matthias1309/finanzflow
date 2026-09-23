import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

export const categoryRulesRouter = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const learnEntrySchema = z.object({
  description: z.string().min(1).max(200).trim(),
  categoryId:  z.number().int().positive(),
});

const learnBatchSchema = z.array(learnEntrySchema).min(1).max(500);

// ─── Routes ───────────────────────────────────────────────────────────────────

categoryRulesRouter.get("/", (_req, res) => {
  res.json(storage.getCategoryRules());
});

/**
 * Lernt aus bestätigten Importen.
 * Body: [{ description: string (max 200), categoryId: number }, ...]
 */
categoryRulesRouter.post("/learn", (req, res) => {
  const parsed = learnBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  storage.learnCategoryRules(parsed.data);
  res.json({ learned: parsed.data.length });
});
