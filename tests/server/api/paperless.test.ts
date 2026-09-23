import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import type { PaperlessAccountMapping } from "../../../shared/schema";
import type { OpenDocument } from "../../../server/routes/paperless";

const fetchKontoauszugDocuments = vi.fn();
const downloadDocument = vi.fn();
const parsePDF = vi.fn();

vi.mock("../../../server/paperlessClient", async () => {
  const actual = await vi.importActual<typeof import("../../../server/paperlessClient")>(
    "../../../server/paperlessClient"
  );
  return { ...actual, fetchKontoauszugDocuments, downloadDocument };
});

vi.mock("../../../server/pdfParser", async () => {
  const actual = await vi.importActual<typeof import("../../../server/pdfParser")>("../../../server/pdfParser");
  return { ...actual, parsePDF };
});

const { PaperlessConfigError, PaperlessUnreachableError, PaperlessAuthError } = await import(
  "../../../server/paperlessClient"
);
const { createApp } = await import("../../../server/createApp");

const { app } = createApp();
const agent = request(app);

const PARSED_TX = {
  date: "2026-04-01", month: "2026-04", description: "Rewe", amount: 42.5,
  originalText: "01.04.2026  Rewe  -42,50", type: "expense" as const,
};

beforeEach(() => {
  fetchKontoauszugDocuments.mockReset();
  downloadDocument.mockReset();
  parsePDF.mockReset();
  parsePDF.mockResolvedValue({ bank: "DKB", transactions: [PARSED_TX], rawText: "", errors: [] });
});

async function createAccount(name = "Gemeinschaftskonto"): Promise<number> {
  const res = await agent.post("/api/accounts").send({ name, bank: "ING", color: "#01696f", type: "checking", iban: null });
  return res.body.id;
}

describe("Paperless-Mappings", () => {
  // TC-016-01
  it("legt ein Mapping an und listet es", async () => {
    const accountId = await createAccount();
    const create = await agent.post("/api/paperless/mappings").send({ paperlessTag: "Essenskonto", accountId });
    expect(create.status).toBe(201);
    expect(create.body.paperlessTag).toBe("Essenskonto");

    const list = await agent.get("/api/paperless/mappings");
    expect(list.status).toBe(200);
    expect((list.body as PaperlessAccountMapping[]).some(m => m.paperlessTag === "Essenskonto")).toBe(true);
  });

  it("lehnt ein Mapping ohne Tag ab", async () => {
    const accountId = await createAccount();
    const res = await agent.post("/api/paperless/mappings").send({ paperlessTag: "", accountId });
    expect(res.status).toBe(400);
  });

  // TC-016-02
  it("aktualisiert ein bestehendes Mapping", async () => {
    const accId1 = await createAccount("Auto");
    const accId2 = await createAccount("Auto & Verkehr");
    const create = await agent.post("/api/paperless/mappings").send({ paperlessTag: "Autokonto", accountId: accId1 });

    const update = await agent.put(`/api/paperless/mappings/${create.body.id}`).send({ paperlessTag: "Autokonto", accountId: accId2 });
    expect(update.status).toBe(200);
    expect(update.body.accountId).toBe(accId2);
  });

  it("löscht ein Mapping", async () => {
    const accountId = await createAccount();
    const create = await agent.post("/api/paperless/mappings").send({ paperlessTag: "Tagesgeldkonto", accountId });

    const del = await agent.delete(`/api/paperless/mappings/${create.body.id}`);
    expect(del.status).toBe(200);

    const list = await agent.get("/api/paperless/mappings");
    expect((list.body as PaperlessAccountMapping[]).some(m => m.id === create.body.id)).toBe(false);
  });
});

describe("GET /api/paperless/documents", () => {
  // TC-016-09 (config error variant)
  it("liefert 503, wenn Paperless nicht konfiguriert ist", async () => {
    fetchKontoauszugDocuments.mockRejectedValue(new PaperlessConfigError());
    const res = await agent.get("/api/paperless/documents");
    expect(res.status).toBe(503);
  });

  // TC-016-09
  it("liefert 502, wenn Paperless nicht erreichbar ist", async () => {
    fetchKontoauszugDocuments.mockRejectedValue(new PaperlessUnreachableError());
    const res = await agent.get("/api/paperless/documents");
    expect(res.status).toBe(502);
  });

  // TC-016-10
  it("liefert 401, wenn der API-Token ungültig ist", async () => {
    fetchKontoauszugDocuments.mockRejectedValue(new PaperlessAuthError());
    const res = await agent.get("/api/paperless/documents");
    expect(res.status).toBe(401);
  });

  // TC-016-04, TC-016-05, TC-016-06
  it("klassifiziert Dokumente nach eindeutigem, fehlendem und mehrdeutigem Konto-Tag", async () => {
    const accountId = await createAccount("Gemeinschaftskonto (Klassifizierung)");
    await agent.post("/api/paperless/mappings").send({ paperlessTag: "Essenskonto-Klassifizierung", accountId });

    fetchKontoauszugDocuments.mockResolvedValue([
      { id: 1, title: "Resolved", created: "2026-04-01T00:00:00Z", tags: ["Kontoauszug", "Essenskonto-Klassifizierung"] },
      { id: 2, title: "Unmapped-NoTag", created: "2026-04-01T00:00:00Z", tags: ["Kontoauszug"] },
      { id: 3, title: "Unmapped-UnknownTag", created: "2026-04-01T00:00:00Z", tags: ["Kontoauszug", "Autokonto-Klassifizierung"] },
      { id: 4, title: "Ambiguous", created: "2026-04-01T00:00:00Z", tags: ["Kontoauszug", "Essenskonto-Klassifizierung", "Autokonto-Klassifizierung"] },
    ]);

    const res = await agent.get("/api/paperless/documents");
    expect(res.status).toBe(200);

    const byId = (id: number) => (res.body as OpenDocument[]).find(d => d.id === id);
    expect(byId(1)).toMatchObject({ status: "resolved", accountId, matchedTag: "Essenskonto-Klassifizierung" });
    expect(byId(2)).toMatchObject({ status: "unmapped", accountId: null, matchedTag: null });
    expect(byId(3)).toMatchObject({ status: "unmapped", accountId: null, matchedTag: "Autokonto-Klassifizierung" });
    expect(byId(4)).toMatchObject({ status: "ambiguous", accountId: null, matchedTag: null });
  });

  // TC-016-03, TC-016-08 (partial — document no longer listed)
  it("blendet bereits importierte Dokumente aus", async () => {
    fetchKontoauszugDocuments.mockResolvedValue([
      { id: 5, title: "Schon importiert", created: "2026-04-01T00:00:00Z", tags: ["Kontoauszug"] },
    ]);
    const accountId = await createAccount();
    await agent.post("/api/paperless/documents/5/confirm").send({ accountId });

    const res = await agent.get("/api/paperless/documents");
    expect((res.body as OpenDocument[]).some(d => d.id === 5)).toBe(false);
  });
});

describe("POST /api/paperless/documents/:id/import", () => {
  it("lehnt eine ungültige ID ab", async () => {
    const res = await agent.post("/api/paperless/documents/abc/import");
    expect(res.status).toBe(400);
  });

  // TC-016-07
  it("lädt das Dokument und liefert eine Vorschau mit Kategorie-Vorschlag", async () => {
    downloadDocument.mockResolvedValue(Buffer.from("%PDF-1.4"));
    const res = await agent.post("/api/paperless/documents/7/import");
    expect(res.status).toBe(200);
    expect(res.body.bank).toBe("DKB");
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0]).toMatchObject({ description: "Rewe", suggestedCategoryId: null });
    expect(downloadDocument).toHaveBeenCalledWith(7);
  });

  // TC-016-10 (import path)
  it("gibt 401 zurück, wenn Paperless den Zugriff verweigert", async () => {
    downloadDocument.mockRejectedValue(new PaperlessAuthError());
    const res = await agent.post("/api/paperless/documents/7/import");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/paperless/documents/:id/confirm", () => {
  it("lehnt eine ungültige ID ab", async () => {
    const res = await agent.post("/api/paperless/documents/abc/confirm").send({ accountId: 1 });
    expect(res.status).toBe(400);
  });

  it("lehnt eine fehlende accountId ab", async () => {
    const res = await agent.post("/api/paperless/documents/8/confirm").send({});
    expect(res.status).toBe(400);
  });

  // TC-016-08
  it("markiert das Dokument als importiert", async () => {
    const accountId = await createAccount();
    const res = await agent.post("/api/paperless/documents/9/confirm").send({ accountId });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
