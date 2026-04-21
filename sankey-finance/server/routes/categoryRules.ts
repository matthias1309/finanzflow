import { Router } from "express";
import { storage } from "../storage";

export const categoryRulesRouter = Router();

categoryRulesRouter.get("/", (_req, res) => {
  res.json(storage.getCategoryRules());
});

/**
 * Lernt aus bestätigten Importen.
 * Body: [{ description: string, categoryId: number }, ...]
 */
categoryRulesRouter.post("/learn", (req, res) => {
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: "Array erwartet" });
  }

  const valid = (req.body as unknown[]).filter(
    (e): e is { description: string; categoryId: number } =>
      typeof (e as any).description === "string" &&
      typeof (e as any).categoryId  === "number",
  );

  storage.learnCategoryRules(valid);
  res.json({ learned: valid.length });
});
