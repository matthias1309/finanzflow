import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { ReplacedTransaction, TransferDetectionRow, TransferSuggestion } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

import { apiRequest } from "./queryClient";

/** Transfer state of an import-preview row, next to the parsed booking. */
export interface TransferState {
  readonly transferToAccountId: number | null;
  readonly counterBookingFromAccountId: number | null;
  /** Stored income that the import deletes because it is this transfer's counter-booking */
  readonly replacesTransaction: ReplacedTransaction | null;
  /** false once the user edited the transfer by hand; later detections leave the row alone */
  readonly isAutoTransfer: boolean;
  readonly skip: boolean;
}

export interface ParsedBooking {
  readonly date: string;
  readonly amount: number;
  readonly type: "income" | "expense";
  readonly counterpartyIban: string | null;
}

export const INITIAL_TRANSFER_STATE: Omit<TransferState, "skip"> = {
  transferToAccountId: null,
  counterBookingFromAccountId: null,
  replacesTransaction: null,
  isAutoTransfer: true,
};

export function toDetectionRow(booking: ParsedBooking, accountId: number | null): TransferDetectionRow {
  return {
    accountId,
    date: booking.date || null,
    amount: Math.abs(booking.amount),
    type: booking.type,
    counterpartyIban: booking.counterpartyIban ?? null,
  };
}

/**
 * Re-runs detection whenever the rows' accounts or bookings change and applies the result to
 * every row the user has not edited by hand.
 */
export function useTransferDetection<Row extends TransferState>(
  detectionRows: readonly TransferDetectionRow[],
  setRows: Dispatch<SetStateAction<Row[]>>,
): void {
  const { toast } = useToast();
  // A string key keeps the effect from re-running on every render's new array.
  const requestKey = JSON.stringify(detectionRows);

  useEffect(() => {
    const rows: TransferDetectionRow[] = JSON.parse(requestKey);
    if (rows.length === 0) return;
    let isStale = false;
    fetchTransferSuggestions(rows)
      .then(suggestions => {
        if (isStale) return;
        setRows(previous =>
          previous.length === suggestions.length
            ? previous.map((row, index) => applyTransferSuggestion(row, suggestions[index]))
            : previous,
        );
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Unbekannter Fehler";
        toast({ title: "Umbuchungen konnten nicht erkannt werden", description: message, variant: "destructive" });
      });
    return () => {
      isStale = true;
    };
  }, [requestKey, setRows, toast]);
}

async function fetchTransferSuggestions(rows: readonly TransferDetectionRow[]): Promise<TransferSuggestion[]> {
  const res = await apiRequest("POST", "/api/transfers/detect", { rows });
  const body: { suggestions: TransferSuggestion[] } = await res.json();
  return body.suggestions;
}

export function applyTransferSuggestion<Row extends TransferState>(row: Row, suggestion: TransferSuggestion): Row {
  if (!row.isAutoTransfer) return row;
  // Only a skip that detection set itself is undone; a skip the user chose stays.
  const skip = row.counterBookingFromAccountId !== null ? false : row.skip;
  if (suggestion.kind === "transfer") {
    return {
      ...row,
      ...INITIAL_TRANSFER_STATE,
      transferToAccountId: suggestion.targetAccountId,
      replacesTransaction: suggestion.replacesTransaction,
      skip,
    };
  }
  if (suggestion.kind === "counterBooking") {
    return { ...row, ...INITIAL_TRANSFER_STATE, counterBookingFromAccountId: suggestion.sourceAccountId, skip: true };
  }
  return { ...row, ...INITIAL_TRANSFER_STATE, skip };
}

/** Manual target change; a replaced income only stays attached to the target it was found for. */
export function withTransferTarget<Row extends TransferState>(row: Row, targetAccountId: number | null): Row {
  const isSameTarget = targetAccountId !== null && targetAccountId === row.transferToAccountId;
  return {
    ...row,
    transferToAccountId: targetAccountId,
    replacesTransaction: isSameTarget ? row.replacesTransaction : null,
    isAutoTransfer: false,
  };
}

/** Manual include/exclude; re-including a counter-booking must not be undone by the next detection. */
export function withSkip<Row extends TransferState>(row: Row, skip: boolean): Row {
  return { ...row, skip, isAutoTransfer: row.counterBookingFromAccountId === null && row.isAutoTransfer };
}

export function transferPayloadFields(
  row: TransferState & { readonly type: "income" | "expense" },
): { type: "income" | "expense" | "transfer"; transferToAccountId: number | null } {
  return row.transferToAccountId === null
    ? { type: row.type, transferToAccountId: null }
    : { type: "transfer", transferToAccountId: row.transferToAccountId };
}

/**
 * Deletes the stored incomes that imported transfers replace. Runs only after the batch save
 * succeeded, so a failed import never loses data. Returns the incomes that could not be deleted.
 */
export async function deleteReplacedIncomes(
  importedRows: readonly TransferState[],
): Promise<ReplacedTransaction[]> {
  const replaced = importedRows
    .filter(row => row.transferToAccountId !== null)
    .map(row => row.replacesTransaction)
    .filter((transaction): transaction is ReplacedTransaction => transaction !== null);
  const results = await Promise.allSettled(
    replaced.map(transaction => apiRequest("DELETE", `/api/transactions/${transaction.id}`)),
  );
  return replaced.filter((_, index) => results[index].status === "rejected");
}

export function replacedIncomeWarning(failed: readonly ReplacedTransaction[]): string {
  const dates = failed.map(transaction => formatGermanDate(transaction.date));
  return failed.length === 1
    ? `Einnahme vom ${dates[0]} konnte nicht entfernt werden`
    : `Einnahmen vom ${dates.join(", ")} konnten nicht entfernt werden`;
}

/** "2026-09-10" → "10.09.2026", without a Date round-trip that could shift the day by time zone */
export function formatGermanDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}
