/**
 * API-Tests für die lernende Kategorisierung (REQ-006). `POST /api/category-rules/learn` und
 * `GET /api/category-rules` decken `storage.learnCategoryRules`/`suggestCategory` end-to-end ab;
 * der Vorschlag selbst wird über `POST /api/import/pdf` (mit gemocktem `parsePDF`) sichtbar
 * gemacht, wie er im echten Import-Flow verwendet wird.
 */
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import type { Category, CategoryRule } from "../../../shared/schema";

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

async function expenseCategoryId(): Promise<number> {
  const res = await agent.get("/api/categories");
  return (res.body as Category[]).find(c => c.type === "expense")!.id;
}

async function suggestFor(description: string): Promise<number | null> {
  parsePDF.mockResolvedValueOnce({
    bank: "DKB",
    transactions: [{ date: "2026-04-01", month: "2026-04", description, amount: -10, originalText: description, type: "expense" }],
    rawText: "",
    errors: [],
  });
  const res = await agent.post("/api/import/pdf").attach("pdf", MINIMAL_PDF, {
    filename: "x.pdf", contentType: "application/pdf",
  });
  return res.body.transactions[0].suggestedCategoryId;
}

describe("POST /api/category-rules/learn", () => {
  // TC-006-01 / TC-006-04
  it("learns a keyword rule and applies it as a suggestion on the next import", async () => {
    const categoryId = await expenseCategoryId();

    const learn = await agent
      .post("/api/category-rules/learn")
      .send([{ description: "Rewe Supermarkt München", categoryId }]);
    expect(learn.status).toBe(200);
    expect(learn.body.learned).toBe(1);

    const rules = (await agent.get("/api/category-rules")).body as CategoryRule[];
    const rule = rules.find(r => r.keyword === "rewe");
    expect(rule).toBeDefined();
    expect(rule!.hits).toBe(1);

    const suggested = await suggestFor("Rewe Filiale 123");
    expect(suggested).toBe(categoryId);
  });

  it("increments hits when the same keyword is learned again", async () => {
    const categoryId = await expenseCategoryId();
    await agent.post("/api/category-rules/learn").send([{ description: "Aldi Süd", categoryId }]);
    await agent.post("/api/category-rules/learn").send([{ description: "Aldi Nord", categoryId }]);

    const rules = (await agent.get("/api/category-rules")).body as CategoryRule[];
    const rule = rules.find(r => r.keyword === "aldi");
    expect(rule!.hits).toBe(2);
  });

  // TC-006-02
  it("prefers the longer matching keyword when suggesting a category", async () => {
    const categories = (await agent.get("/api/categories")).body as Category[];
    const [catShort, catLong] = categories.filter(c => c.type === "expense");

    await agent.post("/api/category-rules/learn").send([{ description: "Amazon", categoryId: catShort.id }]);
    await agent.post("/api/category-rules/learn").send([{ description: "Amazon Prime Video", categoryId: catLong.id }]);

    const suggested = await suggestFor("Amazon Prime Video Abo");
    expect(suggested).toBe(catLong.id);
  });

  // TC-006-05
  it("suggests null for a payee with no matching rule", async () => {
    const suggested = await suggestFor("Vollkommen Unbekannter Zahlungsempfänger XYZ");
    expect(suggested).toBeNull();
  });

  // TC-006-06
  it("does not learn a keyword shorter than 3 characters", async () => {
    const categoryId = await expenseCategoryId();
    await agent.post("/api/category-rules/learn").send([{ description: "ab", categoryId }]);

    const rules = (await agent.get("/api/category-rules")).body as CategoryRule[];
    expect(rules.some(r => r.keyword === "ab")).toBe(false);
  });

  // TC-006-07
  it("accepts a full batch of 500 entries", async () => {
    const categoryId = await expenseCategoryId();
    const batch = Array.from({ length: 500 }, (_, i) => ({
      description: `Zahlungsempfaenger${i}`,
      categoryId,
    }));

    const res = await agent.post("/api/category-rules/learn").send(batch);
    expect(res.status).toBe(200);
    expect(res.body.learned).toBe(500);
  });

  // Regression test — Test Gap Backlog (Session 7, TC-006-08 / TC-011-06): AC-006-08/AC-011-06
  // require that invalid entries in a learn-batch are skipped, not that the whole batch fails.
  // `learnBatchSchema` validates the entire array with one `safeParse`, so a single invalid entry
  // (negative `categoryId`) currently rejects the whole request with 400 and saves nothing,
  // including the otherwise-valid entries. `POST /api/transactions/batch` already has the correct
  // per-item pattern one file over. Documents the CURRENT behavior; flip once `/learn` adopts the
  // same per-item filter (see docs/architecture/ARCH-011.md Open Questions).
  it("known issue: one invalid entry currently fails the entire learn-batch instead of being skipped", async () => {
    const categoryId = await expenseCategoryId();
    const res = await agent.post("/api/category-rules/learn").send([
      { description: "Valider Eintrag", categoryId },
      { description: "Ungültiger Eintrag", categoryId: -1 },
    ]);
    expect(res.status).toBe(400);

    const rules = (await agent.get("/api/category-rules")).body as CategoryRule[];
    expect(rules.some(r => r.keyword === "valider")).toBe(false);
  });

  it("rejects a non-array body", async () => {
    const res = await agent.post("/api/category-rules/learn").send({ not: "an array" });
    expect(res.status).toBe(400);
  });

  it("rejects a batch exceeding 500 items", async () => {
    const categoryId = await expenseCategoryId();
    const batch = Array.from({ length: 501 }, (_, i) => ({ description: `X${i}`, categoryId }));
    const res = await agent.post("/api/category-rules/learn").send(batch);
    expect(res.status).toBe(400);
  });
});
