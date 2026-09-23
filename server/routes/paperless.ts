import { Router, type Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertPaperlessAccountMappingSchema } from "@shared/schema";
import { parsePDF } from "../pdfParser";
import {
  fetchKontoauszugDocuments, downloadDocument, KONTOAUSZUG_TAG,
  PaperlessConfigError, PaperlessUnreachableError, PaperlessAuthError, PaperlessApiError,
  type PaperlessDocumentWithTags,
} from "../paperlessClient";

export const paperlessRouter = Router();

const PDF_TIMEOUT_MS = 10_000;

// ─── Fehlerbehandlung ───────────────────────────────────────────────────────

function respondPaperlessError(err: unknown, res: Response): void {
  if (err instanceof PaperlessConfigError)      { res.status(503).json({ error: err.message }); return; }
  if (err instanceof PaperlessUnreachableError) { res.status(502).json({ error: err.message }); return; }
  if (err instanceof PaperlessAuthError)        { res.status(401).json({ error: err.message }); return; }
  if (err instanceof PaperlessApiError)         { res.status(502).json({ error: err.message }); return; }
  throw err;
}

// ─── Mappings (Paperless-Tag → Konto) ───────────────────────────────────────

paperlessRouter.get("/mappings", (_req, res) => {
  res.json(storage.getPaperlessMappings());
});

paperlessRouter.post("/mappings", (req, res) => {
  const parsed = insertPaperlessAccountMappingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.status(201).json(storage.createPaperlessMapping(parsed.data));
});

paperlessRouter.put("/mappings/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });
  const parsed = insertPaperlessAccountMappingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const mapping = storage.updatePaperlessMapping(id, parsed.data);
  if (!mapping) return res.status(404).json({ error: "Nicht gefunden" });
  res.json(mapping);
});

paperlessRouter.delete("/mappings/:id", (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Ungültige ID" });
  storage.deletePaperlessMapping(id);
  res.json({ ok: true });
});

// ─── Offene Dokumente ───────────────────────────────────────────────────────

type DocumentStatus = "resolved" | "unmapped" | "ambiguous";

interface OpenDocument {
  id: number;
  title: string;
  created: string;
  status: DocumentStatus;
  accountId: number | null;
  matchedTag: string | null;
}

function resolveDocument(doc: PaperlessDocumentWithTags, mappingByTag: Map<string, number>): OpenDocument {
  const accountTags = doc.tags.filter(t => t !== KONTOAUSZUG_TAG);
  const base = { id: doc.id, title: doc.title, created: doc.created };

  if (accountTags.length > 1) return { ...base, status: "ambiguous", accountId: null, matchedTag: null };
  if (accountTags.length === 0) return { ...base, status: "unmapped", accountId: null, matchedTag: null };

  const [tag] = accountTags;
  const accountId = mappingByTag.get(tag) ?? null;
  return { ...base, status: accountId ? "resolved" : "unmapped", accountId, matchedTag: tag };
}

paperlessRouter.get("/documents", async (_req, res) => {
  try {
    const documents = await fetchKontoauszugDocuments();
    const importedIds = storage.getImportedPaperlessDocumentIds();
    const mappingByTag = new Map(storage.getPaperlessMappings().map(m => [m.paperlessTag, m.accountId]));

    const open: OpenDocument[] = documents
      .filter(d => !importedIds.has(d.id))
      .map(d => resolveDocument(d, mappingByTag));

    res.json(open);
  } catch (err) {
    respondPaperlessError(err, res);
  }
});

// ─── Dokument importieren (parsen) & bestätigen ─────────────────────────────

paperlessRouter.post("/documents/:id/import", async (req, res) => {
  const documentId = parseInt(req.params.id);
  if (isNaN(documentId)) return res.status(400).json({ error: "Ungültige ID" });

  try {
    const buffer = await downloadDocument(documentId);
    const result = await Promise.race([
      parsePDF(buffer),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("PDF-Verarbeitung Timeout")), PDF_TIMEOUT_MS)
      ),
    ]);
    const transactions = result.transactions.map(tx => ({
      ...tx,
      suggestedCategoryId: storage.suggestCategory(tx.description),
    }));
    res.json({ ...result, transactions });
  } catch (err) {
    if (
      err instanceof PaperlessConfigError || err instanceof PaperlessUnreachableError ||
      err instanceof PaperlessAuthError || err instanceof PaperlessApiError
    ) {
      return respondPaperlessError(err, res);
    }
    console.error("Paperless-PDF-Verarbeitung fehlgeschlagen:", err);
    res.status(500).json({ error: "PDF konnte nicht verarbeitet werden. Bitte Dokument prüfen." });
  }
});

const confirmSchema = z.object({
  accountId: z.number().int().positive(),
});

/**
 * Markiert ein Dokument als importiert. Die Transaktionen selbst werden zuvor
 * clientseitig über die bestehenden Endpunkte POST /api/transactions/batch
 * und POST /api/category-rules/learn gespeichert (Wiederverwendung REQ-005/006).
 */
paperlessRouter.post("/documents/:id/confirm", (req, res) => {
  const documentId = parseInt(req.params.id);
  if (isNaN(documentId)) return res.status(400).json({ error: "Ungültige ID" });
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  storage.recordPaperlessImport({ paperlessDocumentId: documentId, accountId: parsed.data.accountId });
  res.json({ ok: true });
});
