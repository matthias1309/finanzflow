import { Router } from "express";
import multer from "multer";
import { storage } from "../storage";
import { parsePDF } from "../pdfParser";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "application/x-pdf"]);
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Ungültiger Dateityp: ${file.mimetype}. Nur PDF-Dateien erlaubt.`));
    }
  },
});

export const pdfRouter = Router();

pdfRouter.post("/", upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Keine PDF-Datei hochgeladen" });
  }

  // Zusätzliche Signatur-Prüfung: PDF beginnt immer mit %PDF-
  if (!req.file.buffer.slice(0, 5).toString("ascii").startsWith("%PDF-")) {
    return res.status(400).json({ error: "Datei ist kein gültiges PDF (ungültige Signatur)" });
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
