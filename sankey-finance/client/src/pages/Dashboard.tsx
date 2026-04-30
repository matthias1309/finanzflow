import { safeCssColor } from "@/lib/config";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import SankeyChart from "@/components/SankeyChart";
import TwoFactorSetup from "@/components/TwoFactorSetup";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Landmark, Eye, EyeOff } from "lucide-react";
import type { Account } from "@shared/schema";

function fmtEUR(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);
}
function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

interface AccountSummary {
  account: Account;
  totalIncome: number;
  totalExpenses: number;
  incomeByCategory: Record<number, { name: string; color: string; total: number }>;
  expenseByCategory: Record<number, { name: string; color: string; total: number }>;
  transfersOut: Record<number, number>;
}

interface SummaryData {
  totalIncome: number;
  totalExpenses: number;
  accountSummaries: Record<number, AccountSummary>;
  accounts: Account[];
}

export default function Dashboard() {
  const { data: months = [] } = useQuery<string[]>({ queryKey: ["/api/months"] });
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [hiddenAccounts, setHiddenAccounts] = useState<Set<number>>(new Set());

  const allMonths = useMemo(() => {
    return [...new Set([currentMonth, ...months])].sort().reverse();
  }, [months, currentMonth]);

  const { data: summary, isLoading } = useQuery<SummaryData>({
    queryKey: ["/api/summary", selectedMonth],
    queryFn: () => apiRequest("GET", `/api/summary/${selectedMonth}`).then(r => r.json()),
  });

  function toggleAccount(id: number) {
    setHiddenAccounts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Recompute totals from visible accounts only
  const filteredSummary = useMemo<SummaryData | undefined>(() => {
    if (!summary) return undefined;
    const visibleAccounts = summary.accounts.filter(a => !hiddenAccounts.has(a.id));
    const visibleSummaries = Object.fromEntries(
      Object.entries(summary.accountSummaries).filter(([id]) => !hiddenAccounts.has(Number(id)))
    ) as Record<number, AccountSummary>;
    const totalIncome   = visibleAccounts.reduce((s, a) => s + (summary.accountSummaries[a.id]?.totalIncome   ?? 0), 0);
    const totalExpenses = visibleAccounts.reduce((s, a) => s + (summary.accountSummaries[a.id]?.totalExpenses ?? 0), 0);
    return { accounts: visibleAccounts, accountSummaries: visibleSummaries, totalIncome, totalExpenses };
  }, [summary, hiddenAccounts]);

  const savings     = (filteredSummary?.totalIncome ?? 0) - (filteredSummary?.totalExpenses ?? 0);
  const savingsRate = filteredSummary?.totalIncome ? (savings / filteredSummary.totalIncome) * 100 : 0;

  return (
    <div className="flex flex-col flex-1">
      <div className="px-8 py-6 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Finanzübersicht</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Geldfluss über alle Konten visualisiert</p>
        </div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger data-testid="select-month" className="w-44 month-badge bg-card border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allMonths.map(m => (
              <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 p-8 space-y-6">
        <TwoFactorSetup />

        {/* KPIs — berechnet nur aus sichtbaren Konten */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Einnahmen", value: filteredSummary?.totalIncome ?? 0, color: "text-green-500", icon: TrendingUp },
            { label: "Ausgaben",  value: filteredSummary?.totalExpenses ?? 0, color: "text-red-400",   icon: TrendingDown },
            { label: "Bilanz",    value: savings, color: savings >= 0 ? "text-primary" : "text-red-400", icon: PiggyBank },
          ].map(({ label, value, color, icon: Icon }) => (
            <Card key={label} className="bg-card border-border">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                  <Icon size={14} className={color} />
                </div>
                {isLoading ? <Skeleton className="h-7 w-28" /> : (
                  <p className={`text-xl font-semibold tabular-nums ${color}`}>{fmtEUR(value)}</p>
                )}
              </CardContent>
            </Card>
          ))}
          <Card className="bg-card border-border">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sparquote</span>
                <Wallet size={14} className="text-blue-400" />
              </div>
              {isLoading ? <Skeleton className="h-7 w-20" /> : (
                <p className={`text-xl font-semibold tabular-nums ${savingsRate >= 0 ? "text-blue-400" : "text-red-400"}`}>
                  {savingsRate.toFixed(1)} %
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Per-account breakdown — alle Konten anzeigen, ausgeblendete gedimmt */}
        {summary && summary.accounts.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {summary.accounts.map(acc => {
              const s       = summary.accountSummaries[acc.id];
              if (!s) return null;
              const bal     = s.totalIncome - s.totalExpenses;
              const hidden  = hiddenAccounts.has(acc.id);
              return (
                <Card
                  key={acc.id}
                  className={`bg-card border-border cursor-pointer select-none transition-opacity ${hidden ? "opacity-40" : "hover:border-muted-foreground/30"}`}
                  data-testid={`account-kpi-${acc.id}`}
                  onClick={() => toggleAccount(acc.id)}
                  title={hidden ? "Konto einblenden" : "Konto ausblenden"}
                >
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: safeCssColor(acc.color) }} />
                      <span className="text-xs font-medium text-foreground truncate">{acc.name}</span>
                      <Badge variant="secondary" className="ml-auto text-xs border-0 px-1.5 py-0">{acc.bank}</Badge>
                      <span className="text-muted-foreground flex-shrink-0">
                        {hidden ? <EyeOff size={11} /> : <Eye size={11} />}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>+{fmtEUR(s.totalIncome)}</span>
                      <span>−{fmtEUR(s.totalExpenses)}</span>
                      <span className={`font-semibold tabular-nums ${bal >= 0 ? "text-green-500" : "text-red-400"}`}>
                        {fmtEUR(bal)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* No accounts hint */}
        {summary && summary.accounts.length === 0 && (
          <Card className="bg-card border-border border-dashed">
            <CardContent className="py-10 text-center">
              <Landmark size={28} className="mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">Noch keine Konten angelegt.</p>
              <p className="text-xs text-muted-foreground mt-1">Unter <strong>Konten</strong> kannst du deine Girokonten, Tagesgeldkonten etc. anlegen.</p>
            </CardContent>
          </Card>
        )}

        {/* Sankey — nur sichtbare Konten */}
        <Card className="bg-card border-border" data-testid="sankey-card">
          <CardHeader className="pb-2 px-6 pt-5">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <svg viewBox="0 0 20 20" width="15" height="15" fill="none">
                <path d="M2 6h5v8H2zM8 4h4v12H8zM14 8h4v6h-4z" fill="currentColor" opacity="0.7" />
              </svg>
              Sankey — {fmtMonth(selectedMonth)}
              {hiddenAccounts.size > 0 && (
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {hiddenAccounts.size} Konto{hiddenAccounts.size > 1 ? "en" : ""} ausgeblendet
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-6">
            {isLoading ? (
              <div className="space-y-3 py-8">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-4 w-full" />)}
              </div>
            ) : (
              <SankeyChart
                accountSummaries={filteredSummary?.accountSummaries ?? {}}
                accounts={filteredSummary?.accounts ?? []}
                totalIncome={filteredSummary?.totalIncome ?? 0}
                totalExpenses={filteredSummary?.totalExpenses ?? 0}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
