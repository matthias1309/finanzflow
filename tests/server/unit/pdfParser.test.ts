import { describe, it, expect } from "vitest";
import {
  parseGermanAmount,
  parseGermanDate,
  detectBank,
  parseN26,
  parseDKB,
  parseTradeRepublic,
  parseGeneric,
} from "../../../server/pdfParser";

describe("parseGermanAmount", () => {
  it("parses a positive amount with thousands separator", () => {
    expect(parseGermanAmount("3.200,00")).toBeCloseTo(3200.0);
  });

  it("parses a negative amount", () => {
    expect(parseGermanAmount("-45,50")).toBeCloseTo(-45.5);
  });

  it("strips € symbol", () => {
    expect(parseGermanAmount("1.234,56€")).toBeCloseTo(1234.56);
  });

  it("parses a simple two-decimal amount", () => {
    expect(parseGermanAmount("0,99")).toBeCloseTo(0.99);
  });

  it("handles a plus-prefixed amount", () => {
    expect(parseGermanAmount("+500,00")).toBeCloseTo(500.0);
  });

  it("returns NaN for unparseable input", () => {
    expect(parseGermanAmount("abc")).toBeNaN();
  });
});

describe("parseGermanDate", () => {
  it("parses a full DD.MM.YYYY date", () => {
    const result = parseGermanDate("15.04.2026");
    expect(result).toEqual({ iso: "2026-04-15", month: "2026-04" });
  });

  it("parses a two-digit year ≤ 50 as 2000s", () => {
    const result = parseGermanDate("01.03.26");
    expect(result).toEqual({ iso: "2026-03-01", month: "2026-03" });
  });

  it("parses a two-digit year > 50 as 1900s", () => {
    const result = parseGermanDate("31.12.99");
    expect(result).toEqual({ iso: "1999-12-31", month: "1999-12" });
  });

  it("returns null for non-date strings", () => {
    expect(parseGermanDate("not a date")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseGermanDate("")).toBeNull();
  });
});

describe("detectBank", () => {
  it("detects N26 by BIC marker", () => {
    expect(detectBank("... ntsbdeb1 ...")).toBe("N26");
  });

  it("detects N26 by name", () => {
    expect(detectBank("N26 Bank AG")).toBe("N26");
  });

  it("detects DKB by name", () => {
    expect(detectBank("Deutsche Kreditbank AG")).toBe("DKB");
  });

  it("detects DKB by BIC", () => {
    expect(detectBank("BIC: BYLADEM1001")).toBe("DKB");
  });

  it("detects ING by name", () => {
    expect(detectBank("ING-DiBa AG")).toBe("ING");
  });

  it("detects ING by BIC", () => {
    expect(detectBank("ingddeff")).toBe("ING");
  });

  it("detects Trade Republic by name", () => {
    expect(detectBank("Trade Republic Bank GmbH")).toBe("Trade Republic");
  });

  it("detects Trade Republic by BIC", () => {
    expect(detectBank("BIC TRBKDEBBXXX")).toBe("Trade Republic");
  });

  it("returns Sonstige for unknown content", () => {
    expect(detectBank("Sparkasse Musterstadt Kontoauszug")).toBe("Sonstige");
  });

  it("is case-insensitive", () => {
    expect(detectBank("DEUTSCHE KREDITBANK")).toBe("DKB");
  });
});

// TC-005-01 / TC-005-02 (N26 parser)
describe("parseN26", () => {
  it("parses an expense transaction with a context description line", () => {
    const text = ["Kartenzahlung", "Rewe Markt GmbH  15.04.2026  -45,50€"].join("\n");
    const [tx] = parseN26(text);
    expect(tx).toMatchObject({
      date: "2026-04-15",
      month: "2026-04",
      description: "Rewe Markt GmbH – Kartenzahlung",
      amount: 45.5,
      type: "expense",
    });
  });

  it("parses an income transaction (positive amount)", () => {
    const text = "Arbeitgeber GmbH  01.04.2026  +3.200,00€";
    const [tx] = parseN26(text);
    expect(tx.amount).toBe(3200);
    expect(tx.type).toBe("income");
  });

  it("ignores header/footer lookalike lines", () => {
    const text = ["Gutschriften", "IBAN: DE12345678901234567890"].join("\n");
    expect(parseN26(text)).toHaveLength(0);
  });

  it("deduplicates nothing on its own (single pass, no dedup logic in the bank parser itself)", () => {
    const text = "Rewe Markt GmbH  15.04.2026  -45,50€";
    expect(parseN26(text)).toHaveLength(1);
  });
});

// TC-005-01 / TC-005-02 (DKB parser)
describe("parseDKB", () => {
  it("parses an expense transaction, skipping the IBAN line for its description lookback", () => {
    const text = ["Kartenzahlung", "IBAN DE12345678901234567890", "15.04.26  Rewe Markt  -45.50"].join(
      "\n"
    );
    const [tx] = parseDKB(text);
    expect(tx).toMatchObject({
      date: "2026-04-15",
      month: "2026-04",
      description: "Rewe Markt – Kartenzahlung",
      amount: 45.5,
      type: "expense",
    });
  });

  it("parses an income transaction (positive amount, no currency symbol)", () => {
    const text = "01.04.26  Arbeitgeber GmbH  3200.00";
    const [tx] = parseDKB(text);
    expect(tx.amount).toBe(3200);
    expect(tx.type).toBe("income");
  });

  it("ignores footer lines (bank address/imprint)", () => {
    const text = "Taubenstraße 7-9, 10117 Berlin";
    expect(parseDKB(text)).toHaveLength(0);
  });
});

// TC-005-11 (Trade Republic parser)
describe("parseTradeRepublic", () => {
  it("parses a dividend payout as income with an abbreviated German month", () => {
    const text =
      "28 Aug. 2026    Ertrag  Cash Dividend for ISIN US0389231087         3,72 €                            20.590,85 €";
    const [tx] = parseTradeRepublic(text);
    expect(tx).toMatchObject({
      date: "2026-08-28",
      month: "2026-08",
      description: "Cash Dividend for ISIN US0389231087",
      amount: 3.72,
      type: "income",
    });
  });

  it("parses an interest payment as income", () => {
    const text =
      "01 Aug. 2026    Zinsen  Interest payment                        39,08 €                           20.531,66 €";
    const [tx] = parseTradeRepublic(text);
    expect(tx).toMatchObject({ date: "2026-08-01", month: "2026-08", amount: 39.08, type: "income" });
  });

  it("parses a withdrawal as an expense", () => {
    const text =
      "05 Sep. 2026    Auszahlung  Auszahlung an Referenzkonto             100,00 €                          20.490,85 €";
    const [tx] = parseTradeRepublic(text);
    expect(tx).toMatchObject({ amount: 100, type: "expense" });
  });

  it("ignores GELDMARKTFONDS purchase rows (numeric-only description, no letters)", () => {
    const text = "20 Aug. 2026      Kauf                                                37,91  1,00 €             37,91 €";
    expect(parseTradeRepublic(text)).toHaveLength(0);
  });

  it("ignores the column header line", () => {
    const text =
      "DATUM            TYP     BESCHREIBUNG                                    ZAHLUNGSEINGANG       ZAHLUNGSAUSGANG                 SALDO";
    expect(parseTradeRepublic(text)).toHaveLength(0);
  });

  it("returns an empty array for text with no matching lines", () => {
    expect(parseTradeRepublic("TRANSAKTIONSÜBERSICHT\nSeite 1 von 2")).toHaveLength(0);
  });
});

// TC-005-03 (generic fallback — the function itself, complementing the existing route-level coverage)
describe("parseGeneric", () => {
  it("parses a single-date line", () => {
    const [tx] = parseGeneric("01.04.2026 Miete Wohnung -900,00");
    expect(tx).toMatchObject({ date: "2026-04-01", description: "Miete Wohnung", amount: -900 });
  });

  it("parses a two-date line (Buchungs-/Wertstellungsdatum)", () => {
    const [tx] = parseGeneric("01.04.2026 03.04.2026 Überweisung Miete -900,00 EUR");
    expect(tx).toMatchObject({ date: "2026-04-01", description: "Überweisung Miete", amount: -900 });
  });

  it("parses an amount-first line", () => {
    const [tx] = parseGeneric("+3.200,00 01.04.2026 Gehalt April");
    expect(tx).toMatchObject({ date: "2026-04-01", description: "Gehalt April", amount: 3200 });
  });

  it("skips lines with a too-short description", () => {
    expect(parseGeneric("01.04.2026 xy -10,00")).toHaveLength(0);
  });

  it("returns an empty array for text with no matching lines", () => {
    expect(parseGeneric("Kontoauszug\nSeite 1 von 3")).toHaveLength(0);
  });
});
