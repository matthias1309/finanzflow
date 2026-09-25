import {
  normalizeIban,
  type Account,
  type Transaction,
  type TransferDetectionRow,
  type TransferSuggestion,
} from "@shared/schema";

/** SEPA transfers between German banks settle within 1–2 business days; 3 days covers a weekend. */
export const MATCH_WINDOW_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const NO_SUGGESTION: TransferSuggestion = { kind: "none" };

export interface DetectTransfersOptions {
  readonly rows: readonly TransferDetectionRow[];
  readonly accounts: readonly Account[];
  /** Stored transactions around the rows' dates — see candidateDateRange() */
  readonly candidates: readonly Transaction[];
}

export interface DateRange {
  readonly fromDate: string;
  readonly toDate: string;
}

interface Detection {
  readonly suggestion: TransferSuggestion;
  /** Stored transaction this suggestion relies on; one stored row may back one suggestion only */
  readonly claimedTransactionId: number | null;
}

/** Only dated transactions can match — the window is defined on booking dates. */
type DatedTransaction = Transaction & { readonly date: string };

interface RowContext {
  readonly row: TransferDetectionRow & { readonly accountId: number };
  readonly candidates: readonly DatedTransaction[];
}

const NO_DETECTION: Detection = { suggestion: NO_SUGGESTION, claimedTransactionId: null };

export function detectTransfers(options: DetectTransfersOptions): TransferSuggestion[] {
  const accountIdByIban = buildIbanIndex(options.accounts);
  const datedCandidates = options.candidates.filter(
    (candidate): candidate is DatedTransaction => candidate.date !== null,
  );
  const detections = options.rows.map(row => detectRow(row, accountIdByIban, datedCandidates));
  return releaseContestedClaims(detections);
}

/** The date range whose stored transactions can match any of the rows, or null if no row has a date. */
export function candidateDateRange(rows: readonly TransferDetectionRow[]): DateRange | null {
  const dates = rows.map(row => row.date).filter((date): date is string => date !== null).sort();
  if (dates.length === 0) return null;
  return {
    fromDate: shiftIsoDate(dates[0], -MATCH_WINDOW_DAYS),
    toDate:   shiftIsoDate(dates[dates.length - 1], MATCH_WINDOW_DAYS),
  };
}

function buildIbanIndex(accounts: readonly Account[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const account of accounts) {
    if (account.iban) index.set(normalizeIban(account.iban), account.id);
  }
  return index;
}

function detectRow(
  row: TransferDetectionRow,
  accountIdByIban: ReadonlyMap<string, number>,
  candidates: readonly DatedTransaction[],
): Detection {
  if (row.accountId === null) return NO_DETECTION;
  const context: RowContext = { row: { ...row, accountId: row.accountId }, candidates };
  // A known counterparty is hard evidence: the amount heuristic must not override it.
  if (row.counterpartyIban !== null) {
    const ownAccountId = accountIdByIban.get(normalizeIban(row.counterpartyIban));
    return ownAccountId === undefined ? NO_DETECTION : detectByIban(context, ownAccountId);
  }
  return detectByMatch(context);
}

function detectByIban({ row, candidates }: RowContext, ownAccountId: number): Detection {
  if (ownAccountId === row.accountId) return NO_DETECTION;
  if (row.type === "income") {
    return {
      suggestion: { kind: "counterBooking", sourceAccountId: ownAccountId, basis: "iban" },
      claimedTransactionId: null,
    };
  }
  const replaced = findSingle(
    candidates,
    candidate =>
      candidate.accountId === ownAccountId && candidate.type === "income" && isCounterpart(row, candidate),
  );
  return {
    suggestion: {
      kind: "transfer",
      targetAccountId: ownAccountId,
      basis: "iban",
      replacesTransaction: replaced ? { id: replaced.id, date: replaced.date } : null,
    },
    claimedTransactionId: replaced?.id ?? null,
  };
}

function detectByMatch({ row, candidates }: RowContext): Detection {
  const counterparts = candidates.filter(
    candidate => candidate.accountId !== row.accountId && isCounterpart(row, candidate),
  );
  if (row.type === "income") {
    const transfer = findSingle(
      counterparts,
      candidate => candidate.type === "transfer" && candidate.transferToAccountId === row.accountId,
    );
    if (!transfer) return NO_DETECTION;
    return {
      suggestion: { kind: "counterBooking", sourceAccountId: transfer.accountId, basis: "match" },
      claimedTransactionId: transfer.id,
    };
  }
  const income = findSingle(counterparts, candidate => candidate.type === "income");
  if (!income) return NO_DETECTION;
  return {
    suggestion: {
      kind: "transfer",
      targetAccountId: income.accountId,
      basis: "match",
      replacesTransaction: { id: income.id, date: income.date },
    },
    claimedTransactionId: income.id,
  };
}

/** Same amount to the cent and booking dates at most MATCH_WINDOW_DAYS apart. */
function isCounterpart(row: TransferDetectionRow, candidate: DatedTransaction): boolean {
  if (row.date === null) return false;
  if (toCents(row.amount) !== toCents(candidate.amount)) return false;
  const distanceInDays = Math.abs(Date.parse(row.date) - Date.parse(candidate.date)) / MS_PER_DAY;
  return distanceInDays <= MATCH_WINDOW_DAYS;
}

/** Fail safe: several candidates are as good as none. */
function findSingle(
  candidates: readonly DatedTransaction[],
  predicate: (candidate: DatedTransaction) => boolean,
): DatedTransaction | undefined {
  const matches = candidates.filter(predicate);
  return matches.length === 1 ? matches[0] : undefined;
}

/** A stored transaction claimed by several rows backs none of them. */
function releaseContestedClaims(detections: readonly Detection[]): TransferSuggestion[] {
  const claimCounts = new Map<number, number>();
  for (const { claimedTransactionId } of detections) {
    if (claimedTransactionId === null) continue;
    claimCounts.set(claimedTransactionId, (claimCounts.get(claimedTransactionId) ?? 0) + 1);
  }
  return detections.map(({ suggestion, claimedTransactionId }) => {
    const isContested = claimedTransactionId !== null && (claimCounts.get(claimedTransactionId) ?? 0) > 1;
    if (!isContested || suggestion.kind === "none") return suggestion;
    if (suggestion.kind === "transfer" && suggestion.basis === "iban") {
      return { ...suggestion, replacesTransaction: null };
    }
    return NO_SUGGESTION;
  });
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function shiftIsoDate(isoDate: string, days: number): string {
  return new Date(Date.parse(isoDate) + days * MS_PER_DAY).toISOString().slice(0, 10);
}
