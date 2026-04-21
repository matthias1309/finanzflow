import { Router } from "express";
import { storage } from "../storage";
import { insertCategorySchema } from "@shared/schema";

export const categoriesRouter = Router();

categoriesRouter.get("/", (_req, res) => {
  res.json(storage.getCategories());
});

categoriesRouter.post("/", (req, res) => {
  const parsed = insertCategorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.status(201).json(storage.createCategory(parsed.data));
});

categoriesRouter.delete("/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });
  storage.deleteCategory(id);
  res.json({ ok: true });
});
