import { safeCssColor } from "@/lib/config";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useRef, useCallback } from "react";
import type { Account, Category } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { API_BASE } from "@/lib/config";

interface ParsedTx {
  date: string;
  month: string;
  description: string;
  amount: number;
  originalText: string;
  type: "income" | "expense";
  suggestedCategoryId: number | null; // vom Backend vorgeschlagen
}

interface ParseResult {
  bank: string;
  transactions: ParsedTx[];
  rawText: string;
  errors: string[];
}

interface ImportRow extends ParsedTx {
  categoryId: number | null;
  accountId: number | null;
  skip: boolean;
  /** true = Kategorie wurde vom Lern-System vorausgefüllt (noch nicht manuell geändert) */
  autoCategory: boolean;
}

function fmtEUR(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

export default function ImportPDF() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });

  const [dragging, setDragging] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [defaultAccountId, setDefaultAccountId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("pdf", file);
      const resp = await fetch(`${API_BASE}/api/import/pdf`, { method: "POST", body: fd });
      if (!resp.ok) throw new Error("Upload fehlgeschlagen");
      return resp.json() as Promise<ParseResult>;
    },
    onSuccess: (result) => {
      setParseResult(result);
      setDone(false);
      setRows(result.transactions.map(tx => ({
        ...tx,
        // Nutze Vorschlag des Backends falls vorhanden
        categoryId: tx.suggestedCategoryId ?? null,
        accountId: defaultAccountId,
        skip: false,
        autoCategory: tx.suggestedCategoryId != null,
      })));
    },
    onError: (e: any) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
  });

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".pdf")) {
      toast({ title: "Nur PDF-Dateien erlaubt", variant: "destructive" });
      return;
    }
    setDone(false);
    uploadMut.mutate(file);
  }, [defaultAccountId]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const updateRow = (idx: number, patch: Partial<ImportRow>) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      // Wenn die Kategorie manuell geändert wird, autoCategory-Flag entfernen
      const updated = { ...r, ...patch };
      if ("categoryId" in patch) updated.autoCategory = false;
      return updated;
    }));
  };

  const setAllAccount = (accId: number) => {
    setRows(prev => prev.map(r => ({ ...r, accountId: accId })));
  };

  const doImport = async () => {
    const toImport = rows.filter(r => !r.skip && r.accountId);
    if (toImport.length === 0) { toast({ title: "Keine Buchungen ausgewählt" }); return; }

    setImporting(true);
    try {
      // 1. Buchungen importieren
      const payload = toImport.map(r => ({
        month: r.month,
        date: r.date,
        description: r.description,
        amount: Math.abs(r.amount),
        accountId: r.accountId!,
        categoryId: r.categoryId ?? null,
        type: r.type,
        importSource: "pdf",
        originalText: r.originalText,
        transferToAccountId: null,
      }));
      await apiRequest("POST", "/api/transactions/batch", payload);

      // 2. Lern-System aktualisieren: nur Buchungen mit gesetzter Kategorie
      const toLearn = toImport
        .filter(r => r.categoryId != null)
        .map(r => ({ description: r.description, categoryId: r.categoryId! }));
      if (toLearn.length > 0) {
        await apiRequest("POST", "/api/category-rules/learn", toLearn);
      }

      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/months"] });
      qc.invalidateQueries({ queryKey: ["/api/summary"] });
      setDone(true);

      const autoCount = toImport.filter(r => r.autoCategory).length;
      toast({
        title: `${toImport.length} Buchungen importiert`,
        description: autoCount > 0
          ? `${autoCount} Kategorien wurden automatisch erkannt`
          : undefined,
      });
    } catch (e: any) {
      toast({ title: "Import fehlgeschlagen", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const incCats = categories.filter(c => c.type === "income");
  const expCats = categories.filter(c => c.type === "expense");
  const totalToImport = rows.filter(r => !r.skip).length;
  const uncategorized = rows.filter(r => !r.skip && !r.categoryId).length;
  const autoSuggested = rows.filter(r => !r.skip && r.autoCategory).length;

  return (
    <TooltipProvider>
    <div className="flex flex-col flex-1">
      <div className="px-4 py-4 md:px-8 md:py-6 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">PDF importieren</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kontoauszüge von ING, DKB oder N26 hochladen</p>
      </div>

      <div className="flex-1 p-4 md:p-8 space-y-6">
        {/* Upload area */}
        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-5 px-6">
            <div className="flex items-end gap-4 mb-4">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">
                  Standard-Konto für diesen Import
                </label>
                <Select
                  value={defaultAccountId ? String(defaultAccountId) : ""}
                  onValueChange={v => { const id = parseInt(v); setDefaultAccountId(id); setRows(prev => prev.map(r => ({ ...r, accountId: id }))); }}
                >
                  <SelectTrigger data-testid="select-default-account" className="w-56 bg-background border-border">
                    <SelectValue placeholder="Konto wählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: safeCssColor(a.color) }} />
                          {a.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Drop zone */}
            <div
              data-testid="drop-zone"
              className={`border-2 border-dashed rounded-lg flex flex-col items-center justify-center py-12 cursor-pointer transition-colors ${
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              {uploadMut.isPending ? (
                <><Loader2 size={28} className="text-primary animate-spin mb-3" /><p className="text-sm text-muted-foreground">PDF wird verarbeitet…</p></>
              ) : (
                <>
                  <Upload size={28} className="text-muted-foreground mb-3 opacity-60" />
                  <p className="text-sm font-medium text-foreground">PDF hier ablegen oder klicken</p>
                  <p className="text-xs text-muted-foreground mt-1">ING · DKB · N26 · max. 20 MB</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </CardContent>
        </Card>

        {/* Parse errors */}
        {parseResult?.errors && parseResult.errors.length > 0 && (
          <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">
            <AlertCircle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              {parseResult.errors.map((e, i) => <p key={i} className="text-sm text-destructive">{e}</p>)}
            </div>
          </div>
        )}

        {/* Success banner after import */}
        {done && (
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
            <CheckCircle2 size={16} className="text-green-500" />
            <p className="text-sm text-green-600 dark:text-green-400">Import abgeschlossen. Die Buchungen sind jetzt im Dashboard sichtbar.</p>
          </div>
        )}

        {/* Preview table */}
        {rows.length > 0 && !done && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 px-6 pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileText size={14} />
                    Erkannte Buchungen
                    <Badge variant="secondary" className="border-0">{parseResult?.bank ?? "Unbekannt"}</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                    <span>{totalToImport} von {rows.length} werden importiert</span>
                    {autoSuggested > 0 && (
                      <span className="flex items-center gap-1 text-primary">
                        <Sparkles size={11} />
                        {autoSuggested} Kategorien automatisch erkannt
                      </span>
                    )}
                    {uncategorized > 0 && (
                      <span className="text-yellow-500 dark:text-yellow-400">
                        · {uncategorized} noch ohne Kategorie
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {accounts.length > 0 && (
                    <Select onValueChange={v => setAllAccount(parseInt(v))}>
                      <SelectTrigger className="w-40 h-8 text-xs bg-background">
                        <SelectValue placeholder="Alle: Konto setzen" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <Button size="sm" onClick={doImport} disabled={importing || totalToImport === 0} className="gap-1.5">
                    {importing && <Loader2 size={13} className="animate-spin" />}
                    {importing ? "Importiere…" : `${totalToImport} importieren`}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-auto max-h-[520px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border">
                      <th className="w-8 px-4 py-2.5 text-left" />
                      <th className="px-4 py-2.5 text-left text-xs text-muted-foreground uppercase tracking-wide font-medium">Datum</th>
                      <th className="px-4 py-2.5 text-left text-xs text-muted-foreground uppercase tracking-wide font-medium">Beschreibung</th>
                      <th className="px-4 py-2.5 text-left text-xs text-muted-foreground uppercase tracking-wide font-medium">Konto</th>
                      <th className="px-4 py-2.5 text-left text-xs text-muted-foreground uppercase tracking-wide font-medium">Kategorie</th>
                      <th className="px-4 py-2.5 text-right text-xs text-muted-foreground uppercase tracking-wide font-medium">Betrag</th>
                      <th className="w-8 px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx}
                        className={`border-b border-border/50 transition-colors ${row.skip ? "opacity-35" : "hover:bg-muted/20"}`}
                        data-testid={`import-row-${idx}`}
                      >
                        {/* Skip checkbox */}
                        <td className="px-4 py-2">
                          <input type="checkbox" checked={!row.skip}
                            onChange={e => updateRow(idx, { skip: !e.target.checked })}
                            className="accent-primary w-3.5 h-3.5"
                          />
                        </td>

                        {/* Date */}
                        <td className="px-4 py-2 text-muted-foreground tabular-nums text-xs whitespace-nowrap">
                          {row.date || row.month}
                        </td>

                        {/* Description */}
                        <td className="px-4 py-2 max-w-xs">
                          <p className="truncate text-foreground text-xs">{row.description}</p>
                        </td>

                        {/* Account selector */}
                        <td className="px-3 py-2">
                          <Select
                            value={row.accountId ? String(row.accountId) : ""}
                            onValueChange={v => updateRow(idx, { accountId: parseInt(v) })}
                            disabled={row.skip}
                          >
                            <SelectTrigger className="h-7 text-xs w-36 bg-background border-border">
                              <SelectValue placeholder="Konto…" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map(a => (
                                <SelectItem key={a.id} value={String(a.id)}>
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: safeCssColor(a.color) }} />
                                    <span className="truncate max-w-[100px]">{a.name}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Category selector — mit Auto-Vorschlag-Indikator */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Select
                              value={row.categoryId ? String(row.categoryId) : ""}
                              onValueChange={v => updateRow(idx, { categoryId: parseInt(v) })}
                              disabled={row.skip}
                            >
                              <SelectTrigger className={`h-7 text-xs w-40 border-border ${
                                row.autoCategory
                                  ? "border-primary/40 bg-primary/5"
                                  : !row.categoryId && !row.skip
                                    ? "border-yellow-500/50 bg-yellow-500/5"
                                    : "bg-background"
                              }`}>
                                <SelectValue placeholder="Kategorie…" />
                              </SelectTrigger>
                              <SelectContent>
                                <div className="px-2 py-1 text-xs text-muted-foreground font-medium uppercase tracking-wide">Einnahmen</div>
                                {incCats.map(c => <SelectItem key={c.id} value={String(c.id)}><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: safeCssColor(c.color) }} />{c.name}</span></SelectItem>)}
                                <div className="px-2 py-1 text-xs text-muted-foreground font-medium uppercase tracking-wide mt-1">Ausgaben</div>
                                {expCats.map(c => <SelectItem key={c.id} value={String(c.id)}><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: safeCssColor(c.color) }} />{c.name}</span></SelectItem>)}
                              </SelectContent>
                            </Select>
                            {/* Funken-Icon wenn Auto-Vorschlag aktiv */}
                            {row.autoCategory && !row.skip && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-primary opacity-70 cursor-default">
                                    <Sparkles size={11} />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Automatisch erkannt — kann geändert werden
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-2 text-right tabular-nums font-medium text-xs whitespace-nowrap">
                          <span className={row.type === "income" ? "text-green-500" : "text-red-400"}>
                            {row.type === "income" ? "+" : "−"}{fmtEUR(Math.abs(row.amount))}
                          </span>
                        </td>

                        {/* Remove row */}
                        <td className="px-2 py-2">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => setRows(prev => prev.filter((_, i) => i !== idx))}>
                            <X size={11} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
