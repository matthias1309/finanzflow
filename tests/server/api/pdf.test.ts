/**
 * API-Tests für den PDF-Import (REQ-005). `parsePDF` wird an der Modulgrenze gemockt (siehe
 * `paperless.test.ts` für das gleiche Muster) — kein echtes PDF-Binärparsing hier, das ist
 * bereits durch `tests/server/unit/pdfParser.test.ts` abgedeckt.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const parsePDF = vi.fn();

vi.mock("../../../server/pdfParser", async () => {
  const actual = await vi.importActual<typeof import("../../../server/pdfParser")>(
    "../../../server/pdfParser"
  );
  return { ...actual, parsePDF };
});

const { createApp } = await import("../../../server/createApp");
const { app } = createApp();
const agent = request(app);

const MINIMAL_PDF = Buffer.from("%PDF-1.4\n%%EOF");

const PARSED_TX = {
  date: "2026-04-01", month: "2026-04", description: "Rewe", amount: -42.5,
  originalText: "01.04.2026  Rewe  -42,50", type: "expense" as const,
};

beforeEach(() => {
  parsePDF.mockReset();
  parsePDF.mockResolvedValue({ bank: "DKB", transactions: [PARSED_TX], rawText: "", errors: [] });
});

describe("POST /api/import/pdf", () => {
  // TC-005-01 / TC-005-02
  it("parses an uploaded PDF and returns transactions with a category suggestion", async () => {
    const res = await agent.post("/api/import/pdf").attach("pdf", MINIMAL_PDF, {
      filename: "kontoauszug.pdf",
      contentType: "application/pdf",
    });
    expect(res.status).toBe(200);
    expect(res.body.bank).toBe("DKB");
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0].description).toBe("Rewe");
    expect(res.body.transactions[0]).toHaveProperty("suggestedCategoryId");
  });

  it("returns 400 when no file is attached", async () => {
    const res = await agent.post("/api/import/pdf");
    expect(res.status).toBe(400);
  });

  // Regression test — Test Gap Backlog (Session 7, TC-005-04). Investigated in Session 10: the
  // multer `fileFilter` rejects a non-PDF mime type with a plain `Error` that has no `.status`,
  // so createApp.ts's error handler falls through to its 500 default instead of 400. Documents
  // the CURRENT behavior; flip to 400 once `fileFilter` passes a `status: 400`-carrying error
  // (see docs/architecture/ARCH-005.md Open Questions).
  it("known issue: currently returns 500 instead of 400 for a non-PDF upload", async () => {
    const res = await agent.post("/api/import/pdf").attach("pdf", Buffer.from("just text"), {
      filename: "notes.txt",
      contentType: "text/plain",
    });
    expect(res.status).toBe(500);
  });

  it("rejects a file with a PDF mime type but an invalid signature", async () => {
    const res = await agent.post("/api/import/pdf").attach("pdf", Buffer.from("not really a pdf"), {
      filename: "fake.pdf",
      contentType: "application/pdf",
    });
    expect(res.status).toBe(400);
  });

  // TC-005-06
  it("returns 500 with a friendly message when parsing throws", async () => {
    parsePDF.mockRejectedValue(new Error("kaputt"));
    const res = await agent.post("/api/import/pdf").attach("pdf", MINIMAL_PDF, {
      filename: "kontoauszug.pdf",
      contentType: "application/pdf",
    });
    expect(res.status).toBe(500);
    expect(res.body.error).toBeTypeOf("string");
  });

  // TC-005-07
  it("returns an empty transactions array for a PDF with no detected transactions", async () => {
    parsePDF.mockResolvedValue({ bank: "Sonstige", transactions: [], rawText: "", errors: [] });
    const res = await agent.post("/api/import/pdf").attach("pdf", MINIMAL_PDF, {
      filename: "leer.pdf",
      contentType: "application/pdf",
    });
    expect(res.status).toBe(200);
    expect(res.body.transactions).toEqual([]);
  });
});
