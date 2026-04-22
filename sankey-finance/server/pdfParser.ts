// pdf2json uses CommonJS — import via require to avoid ESM interop issues.
// In the CJS bundle produced by esbuild, require() is available natively.
import { createRequire as _createRequire } from "module";
const _require = typeof require !== "undefined" ? require : _createRequire("file:///");
const PDFParser = _require("pdf2json");

export interface ParsedTransaction {
  date: string;
  month: string;
  description: string;
  amount: number;
  originalText: string;
  type: "income" | "expense";
}

export interface ParseResult {
  bank: string;
  transactions: ParsedTransaction[];
  rawText: string;
  errors: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseGermanAmount(s: string): number {
  // Remove thousands separators (.), replace decimal comma with dot, strip currency symbol
  const clean = s.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(clean);
}

function parseGermanDate(s: string): { iso: string; month: string } | null {
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
  if (!m) return null;
  const day = m[1], mo = m[2];
  let year = m[3];
  if (year.length === 2) year = (parseInt(year) > 50 ? "19" : "20") + year;
  return { iso: `${year}-${mo}-${day}`, month: `${year}-${mo}` };
}

// ─── Extract text from PDF ────────────────────────────────────────────────────

async function extractPDFText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, true);
    parser.on("pdfParser_dataError", (err: any) => reject(new Error(err.parserError)));
    parser.on("pdfParser_dataReady", () => {
      const raw: string = parser.getRawTextContent();
      resolve(raw);
    });
    parser.parseBuffer(buffer);
  });
}

// ─── Bank detection ───────────────────────────────────────────────────────────

function detectBank(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("ntsbdeb1") || t.includes("n26 bank") || (t.includes("n26") && t.includes("balance-audit"))) return "N26";
  if (t.includes("deutsche kreditbank") || t.includes("dkb") || t.includes("byladem1001")) return "DKB";
  if (t.includes("ing-diba") || t.includes("ing diba") || t.includes("ing bank") || t.includes("ingddeff")) return "ING";
  return "Sonstige";
}

// ─── N26 parser ───────────────────────────────────────────────────────────────
// N26 PDF layout (per transaction):
//   [optional context lines, e.g. "Wertstellung DD.MM.YYYY"]
//   [optional description line, e.g. "Lohn / Gehalt 03/2026"]
//   [optional IBAN/BIC line]
//   [optional type header: "Gutschriften" | "Lastschriften" | "Belastungen" | "Mastercard…"]
//   NAME                    DD.MM.YYYY       +/-BETRAG€
//
// The key transaction line matches: ends with  DD.MM.YYYY  followed by  ±N.NNN,NN€

function parseN26(text: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];

  // Split by page breaks, then process each page's lines
  const pages = text.split(/----------------Page \(\d+\) Break----------------/);

  // The transaction line pattern:
  //   NAME(s)   DD.MM.YYYY   ±1.234,56€
  //   - name can contain letters, digits, spaces, dots, *, /
  //   - multiple spaces separate name, date, amount
  //   - amount always ends with €, may have + or - prefix
  // Längenbegrenzung auf 100 Zeichen verhindert ReDoS durch exponentielles Backtracking
const TX_LINE = /^(.{1,100}?)\s{2,}(\d{2}\.\d{2}\.\d{4})\s{2,}([+-]?\d{1,3}(?:\.\d{3})*,\d{2})€\s*$/;

  // Also capture Mastercard one-liner format:
  //   "Mastercard • Kategorie" or "Mastercard" on previous line, then TX_LINE
  // And detect description lines that precede the transaction line

  // Lines to skip (headers, footers, page numbers, IBAN lines, etc.)
  const SKIP_LINE = /^(\d+\s*\/\s*\d+|IBAN:|BIC:|Wertstellung|Beschreibung|Verbuchungsdatum|Betrag|Kontoauszug|Zusammenfassung|Dein|Einkommende|Ausgehende|Gutschriften$|Lastschriften$|Belastungen$|Mastercard$|Mastercard\s*•|Einleger|Allgemeine|Einwendungen|Unsere|Es kann|Durchführung|Wir bitten|Vierteljähr|balance-audit|nicht erteilt|dann aber|entsprechend|innerhalb|Wochen nach|Geschäfts|Wertstellung|Anmerkung$)/i;

  for (const page of pages) {
    const lines = page.split("\n").map(l => l.trim()).filter(l => l.length > 0);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(TX_LINE);
      if (!match) continue;

      const nameRaw = match[1].trim();
      const dateStr = match[2];
      const amountStr = match[3];

      // Skip header/footer lookalikes
      if (SKIP_LINE.test(nameRaw)) continue;
      if (/^(Beschreibung|Verbuchungsdatum|Betrag)$/.test(nameRaw)) continue;

      const dateInfo = parseGermanDate(dateStr);
      if (!dateInfo) continue;

      const amount = parseGermanAmount(amountStr);
      if (isNaN(amount)) continue;

      // Build description: look back up to 4 lines for a meaningful context line
      // Skip IBAN lines, Wertstellung lines, type headers, page headers
      let description = nameRaw;
      const contextLines: string[] = [];

      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prev = lines[j].trim();
        if (!prev || SKIP_LINE.test(prev)) continue;
        // Stop if it looks like a previous transaction line
        if (TX_LINE.test(prev)) break;
        // Stop at IBAN/BIC lines
        if (/^(IBAN|BIC):/i.test(prev)) continue;
        // Stop at date-only or date+context lines
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(prev)) continue;
        // Good context line: not just a date, not too long
        // Kontoinhaber-Zeilen (Name + PLZ oder Straßenname) überspringen.
        // Konfigurierbar über Umgebungsvariable ACCOUNT_HOLDER_PATTERN (Regex-String).
        // Beispiel in supervisord .ini: ACCOUNT_HOLDER_PATTERN="Max Mustermann|Musterstraße"
        const holderPattern = process.env.ACCOUNT_HOLDER_PATTERN
          ? new RegExp(process.env.ACCOUNT_HOLDER_PATTERN, "i")
          : null;
        const isAccountHolder = holderPattern ? holderPattern.test(prev) : false;
        if (prev.length > 2 && prev.length < 120 && !isAccountHolder) {
          contextLines.unshift(prev);
          break; // only take the immediately preceding meaningful line
        }
      }

      // Prefer the context line as description if it's more informative than just the payee name
      if (contextLines.length > 0) {
        const ctx = contextLines[0];
        // Use context as description prefix if it adds info (not just the payee name again)
        if (ctx.toLowerCase() !== nameRaw.toLowerCase()) {
          description = `${nameRaw} – ${ctx}`;
        }
      }

      // Clean up description
      description = description.replace(/\s+/g, " ").trim();

      results.push({
        date: dateInfo.iso,
        month: dateInfo.month,
        description,
        amount: Math.abs(amount),
        originalText: line,
        type: amount >= 0 ? "income" : "expense",
      });
    }
  }

  return results;
}

// ─── DKB parser ───────────────────────────────────────────────────────────────
// DKB PDF layout (per transaction):
//   [Beschreibungszeile, e.g. "Picnic 16-03-2026" or "VISA Debitkartenumsatz vom ..."]  
//   IBAN  DE...
//   TT.MM.JJ    NAME (padded with spaces)    BETRAG   (positive = credit, negative = debit)
//
// Key: date is 2-digit year (16.03.26), amount has NO currency symbol, uses dot as decimal

function parseDKB(text: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  const pages = text.split(/----------------Page \(\d+\) Break----------------/);

  // Transaction line: TT.MM.JJ  (spaces)  NAME  (spaces)  BETRAG
  // Amount: optional minus, digits, dot, 2 decimal digits — NO € symbol
  // Name can be long with mixed chars
  // Längenbegrenzung auf 100 Zeichen verhindert ReDoS durch exponentielles Backtracking
const TX_LINE = /^(\d{2}\.\d{2}\.\d{2})\s{2,}(.{1,100}?)\s{2,}(-?\d+\.\d{2})\s*$/;

  const SKIP_LINE = /^(Datum|Erläuterung|Betrag EUR|Seite|IBAN\s|DE\d{2}|Ein Unternehmen|Bayerischen|DKB Deutsche|Taubenstraße|10117 Berlin|USt-ID|Arnulf|Tilo|Dr\. Sven|Handelsregister|Berlin-Charlottenburg|HRB|Stephan|Vorsitzender|www\.dkb|info@dkb|BIC:|Export Umsatz|Zeitraum|Anzahl)/i;

  for (const page of pages) {
    const lines = page.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(TX_LINE);
      if (!match) continue;

      const dateStr  = match[1]; // TT.MM.JJ (2-digit year)
      const nameRaw  = match[2].trim();
      const amountStr = match[3];

      if (SKIP_LINE.test(nameRaw)) continue;
      // Skip the column header line
      if (/^(Erläuterung|Betrag)$/.test(nameRaw)) continue;

      const dateInfo = parseGermanDate(dateStr); // handles 2-digit year via existing logic
      if (!dateInfo) continue;

      const amount = parseFloat(amountStr);
      if (isNaN(amount)) continue;

      // Look back for the description line (skip IBAN line immediately before)
      let description = nameRaw;
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const prev = lines[j].trim();
        if (!prev) continue;
        // Skip the IBAN line
        if (/^IBAN\s+[A-Z]{2}\d/i.test(prev)) continue;
        // Skip previous TX lines
        if (TX_LINE.test(prev)) break;
        // Skip headers/footers
        if (SKIP_LINE.test(prev)) continue;
        // Good description line
        if (prev.length > 2 && prev.toLowerCase() !== nameRaw.toLowerCase()) {
          description = `${nameRaw} – ${prev}`;
        }
        break;
      }

      description = description.replace(/\s+/g, " ").trim();

      results.push({
        date: dateInfo.iso,
        month: dateInfo.month,
        description,
        amount: Math.abs(amount),
        originalText: line,
        type: amount >= 0 ? "income" : "expense",
      });
    }
  }

  return results;
}

// ─── Generic parser (ING, DKB, fallback) ─────────────────────────────────────
// Matches lines like: "01.04.2026  Buchungstext  +3.200,00" or "01.04.2026  03.04.2026  Text  -45,50"

function parseGeneric(text: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  const lines = text.split(/\n|\f/).map(l => l.trim()).filter(l => l.length > 3);

  const patterns = [
    // Two dates + description + amount
    /^(\d{2}\.\d{2}\.\d{4})\s+\d{2}\.\d{2}\.\d{4}\s+(.+?)\s+([-+]?\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:EUR|€)?$/,
    // Single date + description + amount
    /^(\d{2}\.\d{2}\.\d{4})\s+(.+?)\s+([-+]?\d{1,3}(?:\.\d{3})*,\d{2})\s*(?:EUR|€)?$/,
    // Amount at start
    /^([-+]?\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{2}\.\d{2}\.\d{4})\s+(.+)$/,
  ];

  for (const line of lines) {
    for (let pi = 0; pi < patterns.length; pi++) {
      const match = line.match(patterns[pi]);
      if (!match) continue;

      let dateStr: string, desc: string, amountStr: string;
      if (pi === 2) {
        amountStr = match[1]; dateStr = match[2]; desc = match[3];
      } else {
        dateStr = match[1]; desc = match[2]; amountStr = match[3];
      }

      const dateInfo = parseGermanDate(dateStr);
      if (!dateInfo) continue;

      const amount = parseGermanAmount(amountStr);
      if (isNaN(amount)) continue;

      desc = desc.replace(/\s+/g, " ").trim();
      if (desc.length < 3 || /^(seite|iban|bic|kontonummer|datum|betrag|saldo|buchung)/i.test(desc)) continue;

      results.push({
        date: dateInfo.iso,
        month: dateInfo.month,
        description: desc,
        amount,
        originalText: line,
        type: amount >= 0 ? "income" : "expense",
      });
      break;
    }
  }

  return results;
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  const errors: string[] = [];
  let rawText = "";

  try {
    rawText = await extractPDFText(buffer);
  } catch (e: any) {
    return { bank: "Unbekannt", transactions: [], rawText: "", errors: [`PDF konnte nicht gelesen werden: ${e.message}`] };
  }

  const bank = detectBank(rawText);

  // Use bank-specific parser first, fall back to generic
  let txs: ParsedTransaction[] = [];
  if (bank === "N26") {
    txs = parseN26(rawText);
  } else if (bank === "DKB") {
    txs = parseDKB(rawText);
  }
  // If bank-specific parser yielded nothing, try generic
  if (txs.length === 0) {
    txs = parseGeneric(rawText);
  }

  if (txs.length === 0) {
    errors.push("Keine Buchungen automatisch erkannt. Bitte stelle sicher, dass die PDF einen selektierbaren Text enthält (kein Scan). Du kannst Buchungen auch manuell unter 'Buchungen' hinzufügen.");
  }

  // Deduplicate
  const seen = new Set<string>();
  txs = txs.filter(t => {
    const key = `${t.date}|${t.description}|${t.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { bank, transactions: txs, rawText, errors };
}
