/**
 * TC-005-10 — separate file so `pdfRateLimiter`'s in-memory counter starts fresh (each test file
 * gets its own `createApp()` / process, see vitest.config.ts `pool: "forks"`) and isn't consumed
 * by the other PDF-import tests in `pdf.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { listenOnLoopback } from "../loopbackServer";

const parsePDF = vi.fn();

vi.mock("../../../server/pdfParser", async () => {
  const actual = await vi.importActual<typeof import("../../../server/pdfParser")>(
    "../../../server/pdfParser"
  );
  return { ...actual, parsePDF };
});

const { createApp } = await import("../../../server/createApp");
const server = await listenOnLoopback(createApp().app);
afterAll(() => {
  server.close();
});
const agent = request(server);

const MINIMAL_PDF = Buffer.from("%PDF-1.4\n%%EOF");

beforeEach(() => {
  parsePDF.mockReset();
  parsePDF.mockResolvedValue({ bank: "DKB", transactions: [], rawText: "", errors: [] });
});

describe("POST /api/import/pdf — rate limit", () => {
  // TC-005-10
  it("rate-limits PDF uploads after 10 requests within the window", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await agent.post("/api/import/pdf").attach("pdf", MINIMAL_PDF, {
        filename: "kontoauszug.pdf",
        contentType: "application/pdf",
      });
      expect(res.status).toBe(200);
    }
    const res = await agent.post("/api/import/pdf").attach("pdf", MINIMAL_PDF, {
      filename: "kontoauszug.pdf",
      contentType: "application/pdf",
    });
    expect(res.status).toBe(429);
  });
});
