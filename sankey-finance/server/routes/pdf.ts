import { Router } from "express";
import multer from "multer";
import { storage } from "../storage";
import { parsePDF } from "../pdfParser";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const pdfRouter = Router();

pdfRouter.post("/", upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Keine PDF-Datei hochgeladen" });
  }

  try {
    const result = await parsePDF(req.file.buffer);
    const transactions = result.transactions.map(tx => ({
      ...tx,
      suggestedCategoryId: storage.suggestCategory(tx.description),
    }));
    res.json({ ...result, transactions });
  } catch (err: any) {
    res.status(500).json({ error: `PDF-Verarbeitung fehlgeschlagen: ${err.message}` });
  }
});
