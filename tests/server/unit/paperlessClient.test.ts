import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchKontoauszugDocuments, downloadDocument,
  PaperlessConfigError, PaperlessUnreachableError, PaperlessAuthError, PaperlessApiError,
} from "../../../server/paperlessClient";

const ORIGINAL_ENV = { ...process.env };

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("paperlessClient", () => {
  beforeEach(() => {
    process.env.PAPERLESS_BASE_URL = "http://paperless.local";
    process.env.PAPERLESS_API_TOKEN = "test-token";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  describe("fetchKontoauszugDocuments", () => {
    it("throws PaperlessConfigError when PAPERLESS_BASE_URL is missing", async () => {
      delete process.env.PAPERLESS_BASE_URL;
      await expect(fetchKontoauszugDocuments()).rejects.toBeInstanceOf(PaperlessConfigError);
    });

    it("throws PaperlessConfigError when PAPERLESS_API_TOKEN is missing", async () => {
      delete process.env.PAPERLESS_API_TOKEN;
      await expect(fetchKontoauszugDocuments()).rejects.toBeInstanceOf(PaperlessConfigError);
    });

    it("throws PaperlessUnreachableError when the network request fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
      await expect(fetchKontoauszugDocuments()).rejects.toBeInstanceOf(PaperlessUnreachableError);
    });

    it("throws PaperlessAuthError on a 401 response", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 401)));
      await expect(fetchKontoauszugDocuments()).rejects.toBeInstanceOf(PaperlessAuthError);
    });

    it("throws PaperlessApiError on an unexpected error status", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 500)));
      await expect(fetchKontoauszugDocuments()).rejects.toBeInstanceOf(PaperlessApiError);
    });

    it("resolves tag IDs to names and drops unknown tag IDs", async () => {
      const fetchMock = vi.fn(async (url: string) => {
        if (url.includes("/api/tags/")) {
          return jsonResponse({ results: [{ id: 1, name: "Kontoauszug" }, { id: 2, name: "Essenskonto" }] });
        }
        return jsonResponse({
          results: [
            { id: 100, title: "Auszug März", created: "2026-03-01T00:00:00Z", tags: [1, 2] },
            { id: 101, title: "Auszug April", created: "2026-04-01T00:00:00Z", tags: [1, 99] },
          ],
        });
      });
      vi.stubGlobal("fetch", fetchMock);

      const docs = await fetchKontoauszugDocuments();

      expect(docs).toEqual([
        { id: 100, title: "Auszug März", created: "2026-03-01T00:00:00Z", tags: ["Kontoauszug", "Essenskonto"] },
        { id: 101, title: "Auszug April", created: "2026-04-01T00:00:00Z", tags: ["Kontoauszug"] },
      ]);
    });
  });

  describe("downloadDocument", () => {
    it("returns the document content as a Buffer", async () => {
      const bytes = new TextEncoder().encode("%PDF-1.4 dummy");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => bytes.buffer,
      } as unknown as Response));

      const buffer = await downloadDocument(42);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString()).toBe("%PDF-1.4 dummy");
    });

    it("throws PaperlessApiError when the document cannot be found", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, 404)));
      await expect(downloadDocument(999)).rejects.toBeInstanceOf(PaperlessApiError);
    });
  });
});
