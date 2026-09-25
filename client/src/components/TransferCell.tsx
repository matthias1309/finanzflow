import type { Account } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatGermanDate, type TransferState } from "@/lib/transferDetection";

const NO_TRANSFER = "none";

interface TransferCellProps {
  readonly rowIndex: number;
  readonly row: TransferState & { readonly type: "income" | "expense" };
  /** The account the row is imported into; it can never be its own transfer target */
  readonly accountId: number | null;
  readonly accounts: readonly Account[];
  readonly onTargetChange: (targetAccountId: number | null) => void;
}

export function TransferCell({ rowIndex, row, accountId, accounts, onTargetChange }: TransferCellProps) {
  if (row.counterBookingFromAccountId !== null) {
    const source = accounts.find(account => account.id === row.counterBookingFromAccountId);
    return (
      <span data-testid={`transfer-marker-${rowIndex}`} className="text-xs text-muted-foreground whitespace-nowrap">
        Gegenbuchung von {source?.name ?? "anderem Konto"}
      </span>
    );
  }
  // Only the debit side of a transfer is stored (REQ-004); a credit is never a transfer source.
  if (row.type === "income") return <span className="text-xs text-muted-foreground">—</span>;

  const targets = accounts.filter(account => account.id !== accountId);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        {row.transferToAccountId !== null && (
          <span data-testid={`transfer-marker-${rowIndex}`} className="text-xs text-primary font-medium">
            Umbuchung
          </span>
        )}
        <Select
          value={row.transferToAccountId === null ? NO_TRANSFER : String(row.transferToAccountId)}
          onValueChange={value => onTargetChange(value === NO_TRANSFER ? null : parseInt(value))}
          disabled={row.skip}
        >
          <SelectTrigger data-testid={`select-transfer-target-${rowIndex}`} className="h-7 text-xs w-36 bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_TRANSFER}>Keine Umbuchung</SelectItem>
            {targets.map(account => (
              <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {row.replacesTransaction !== null && (
        <span data-testid={`transfer-replaces-${rowIndex}`} className="text-[11px] text-muted-foreground">
          Ersetzt Einnahme vom {formatGermanDate(row.replacesTransaction.date)}
        </span>
      )}
    </div>
  );
}
