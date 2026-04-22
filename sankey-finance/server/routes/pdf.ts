import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { storage } from "../storage";
import { parsePDF } from "../pdfParser";

const ALLOWED_MIME_TYPES  = new Set(["application/pdf", "application/x-pdf"]);
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Ungültiger Dateityp: ${file.mimetype}. Nur PDF-Dateien erlaubt.`));
    }
  },
});

/** Max. 10 PDF-Uploads pro IP in 15 Minuten — verhindert Ressourcen-Erschöpfung */
const pdfRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: "Zu viele Upload-Versuche. Bitte in 15 Minuten erneut versuchen." },
  keyGenerator: (req) => req.ip ?? "unknown",
});

export const pdfRouter = Router();

pdfRouter.post("/", pdfRateLimiter, upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Keine PDF-Datei hochgeladen" });
  }

  // Magic-Byte-Check: PDF beginnt immer mit %PDF-
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
    console.error("PDF-Verarbeitung fehlgeschlagen:", err);
    res.status(500).json({ error: "PDF konnte nicht verarbeitet werden. Bitte Datei prüfen." });
  }
});
