import { Router } from "express";

import { detectTransfersRequestSchema, type Transaction, type TransferDetectionRow } from "@shared/schema";
import { storage } from "../storage";
import { candidateDateRange, detectTransfers } from "../transferDetection";

export const transfersRouter = Router();

/** Read-only: suggests transfers for import-preview rows, nothing is written. */
transfersRouter.post("/detect", (req, res) => {
  const parsed = detectTransfersRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { rows } = parsed.data;
  const suggestions = detectTransfers({
    rows,
    accounts: storage.getAccounts(),
    candidates: loadCandidates(rows),
  });
  res.json({ suggestions });
});

function loadCandidates(rows: readonly TransferDetectionRow[]): Transaction[] {
  const range = candidateDateRange(rows);
  return range ? storage.getTransactionsBetweenDates(range.fromDate, range.toDate) : [];
}
