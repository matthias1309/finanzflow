import { describe, it, expect } from "vitest";
import { parseGermanAmount, parseGermanDate, detectBank } from "../../../server/pdfParser";

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

  it("returns Sonstige for unknown content", () => {
    expect(detectBank("Sparkasse Musterstadt Kontoauszug")).toBe("Sonstige");
  });

  it("is case-insensitive", () => {
    expect(detectBank("DEUTSCHE KREDITBANK")).toBe("DKB");
  });
});
