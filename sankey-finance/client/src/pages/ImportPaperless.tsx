import { safeCssColor } from "@/lib/config";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import type { Account, Category } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, AlertCircle, Trash2, Plus, Download, Tags } from "lucide-react";

interface PaperlessMapping {
  id: number;
  paperlessTag: string;
  accountId: number;
}

type DocumentStatus = "resolved" | "unmapped" | "ambiguous";

interface OpenDocument {
  id: number;
  title: string;
  created: string;
  status: DocumentStatus;
  accountId: number | null;
  matchedTag: string | null;
}

interface ParsedTx {
  date: string;
  month: string;
  description: string;
  amount: number;
  originalText: string;
  type: "income" | "expense";
  suggestedCategoryId: number | null;
}

interface ParseResult {
  bank: string;
  transactions: ParsedTx[];
  rawText: string;
  errors: string[];
}

interface PreviewRow extends ParsedTx {
  categoryId: number | null;
  skip: boolean;
}

function fmtEUR(v: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

/** apiRequest/getQueryFn werfen "STATUS: {json-body}" — extrahiert die lesbare Fehlermeldung daraus. */
function extractApiErrorMessage(rawMessage: string): string {
  const jsonPart = rawMessage.slice(rawMessage.indexOf(": ") + 2);
  try {
    const body = JSON.parse(jsonPart);
    return body.error ?? body.message ?? rawMessage;
  } catch {
    return rawMessage;
  }
}

function statusBadge(status: DocumentStatus): { text: string; variant: "default" | "secondary" | "destructive" } {
  if (status === "resolved")  return { text: "Konto erkannt", variant: "default" };
  if (status === "ambiguous") return { text: "Mehrdeutige Zuordnung", variant: "destructive" };
  return { text: "Kein Konto zugeordnet", variant: "secondary" };
}

// ─── Zuordnungen (Paperless-Tag → Konto) ───────────────────────────────────

function MappingsCard({ accounts }: { accounts: Account[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newTag, setNewTag] = useState("");
  const [newAccountId, setNewAccountId] = useState<number | null>(null);

  const { data: mappings = [] } = useQuery<PaperlessMapping[]>({ queryKey: ["/api/paperless/mappings"] });

  const createMut = useMutation({
    mutationFn: (data: { paperlessTag: string; accountId: number }) =>
      apiRequest("POST", "/api/paperless/mappings", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/paperless/mappings"] });
      qc.invalidateQueries({ queryKey: ["/api/paperless/documents"] });
      setNewTag("");
      setNewAccountId(null);
      toast({ title: "Zuordnung angelegt" });
    },
    onError: (e: Error) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/paperless/mappings/${id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/paperless/mappings"] });
      qc.invalidateQueries({ queryKey: ["/api/paperless/documents"] });
    },
  });

  const accountName = (id: number) => accounts.find(a => a.id === id)?.name ?? "Unbekanntes Konto";
  const addMapping = () => {
    if (!newTag.trim() || !newAccountId) return;
    createMut.mutate({ paperlessTag: newTag.trim(), accountId: newAccountId });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 px-6 pt-5">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Tags size={14} />Zuordnungen: Paperless-Tag → Konto
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-5 space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Paperless-Tag</label>
            <Input data-testid="input-paperless-tag" placeholder="z.B. Essenskonto" value={newTag} onChange={e => setNewTag(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Konto</label>
            <Select value={newAccountId ? String(newAccountId) : ""} onValueChange={v => setNewAccountId(parseInt(v))}>
              <SelectTrigger data-testid="select-mapping-account" className="bg-background border-border">
                <SelectValue placeholder="Konto wählen…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button data-testid="button-add-mapping" size="sm" className="gap-1.5" onClick={addMapping} disabled={createMut.isPending}>
            <Plus size={14} />Hinzufügen
          </Button>
        </div>

        {mappings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Zuordnungen angelegt.</p>
        ) : (
          <div className="space-y-1.5">
            {mappings.map(m => (
              <div key={m.id} data-testid={`mapping-row-${m.id}`} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/30 text-sm">
                <span className="text-foreground">
                  <Badge variant="secondary" className="border-0 mr-2">{m.paperlessTag}</Badge>
                  → {accountName(m.accountId)}
                </span>
                <Button data-testid={`button-delete-mapping-${m.id}`} variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMut.mutate(m.id)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Vorschau eines einzelnen Dokuments ────────────────────────────────────

interface PreviewSectionProps {
  documentId: number;
  parseResult: ParseResult;
  accounts: Account[];
  categories: Category[];
  defaultAccountId: number | null;
  onDone: () => void;
}

function PreviewSection({ documentId, parseResult, accounts, categories, defaultAccountId, onDone }: PreviewSectionProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState<number | null>(defaultAccountId);
  const [rows, setRows] = useState<PreviewRow[]>(
    parseResult.transactions.map(tx => ({ ...tx, categoryId: tx.suggestedCategoryId, skip: false }))
  );
  const [importing, setImporting] = useState(false);

  const toggleSkip = (idx: number) => setRows(prev => prev.map((r, i) => i === idx ? { ...r, skip: !r.skip } : r));
  const setCategory = (idx: number, categoryId: number) =>
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, categoryId } : r));

  const confirmImport = async () => {
    if (!accountId) { toast({ title: "Bitte ein Konto wählen" }); return; }
    const toImport = rows.filter(r => !r.skip);
    if (toImport.length === 0) { toast({ title: "Keine Buchungen ausgewählt" }); return; }

    setImporting(true);
    try {
      const payload = toImport.map(r => ({
        month: r.month, date: r.date, description: r.description, amount: Math.abs(r.amount),
        accountId, categoryId: r.categoryId ?? null, type: r.type,
        importSource: "pdf", originalText: r.originalText, transferToAccountId: null,
      }));
      await apiRequest("POST", "/api/transactions/batch", payload);

      const toLearn = toImport.filter(r => r.categoryId != null).map(r => ({ description: r.description, categoryId: r.categoryId! }));
      if (toLearn.length > 0) await apiRequest("POST", "/api/category-rules/learn", toLearn);

      await apiRequest("POST", `/api/paperless/documents/${documentId}/confirm`, { accountId });

      qc.invalidateQueries({ queryKey: ["/api/transactions"] });
      qc.invalidateQueries({ queryKey: ["/api/months"] });
      qc.invalidateQueries({ queryKey: ["/api/summary"] });
      qc.invalidateQueries({ queryKey: ["/api/paperless/documents"] });
      toast({ title: `${toImport.length} Buchungen importiert` });
      onDone();
    } catch (e: unknown) {
      const message = e instanceof Error ? extractApiErrorMessage(e.message) : "Unbekannter Fehler";
      toast({ title: "Import fehlgeschlagen", description: message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const totalToImport = rows.filter(r => !r.skip).length;

  return (
    <Card className="bg-card border-border" data-testid={`preview-document-${documentId}`}>
      <CardHeader className="pb-2 px-6 pt-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText size={14} />Erkannte Buchungen<Badge variant="secondary" className="border-0">{parseResult.bank}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={accountId ? String(accountId) : ""} onValueChange={v => setAccountId(parseInt(v))}>
              <SelectTrigger data-testid="select-preview-account" className="w-48 h-8 text-xs bg-background border-border">
                <SelectValue placeholder="Konto wählen…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={confirmImport} disabled={importing || totalToImport === 0} className="gap-1.5">
              {importing && <Loader2 size={13} className="animate-spin" />}
              {importing ? "Importiere…" : `${totalToImport} importieren`}
            </Button>
            <Button size="sm" variant="outline" onClick={onDone}>Abbrechen</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-auto max-h-[420px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                <th className="w-8 px-4 py-2.5" />
                <th className="px-4 py-2.5 text-left text-xs text-muted-foreground uppercase tracking-wide font-medium">Datum</th>
                <th className="px-4 py-2.5 text-left text-xs text-muted-foreground uppercase tracking-wide font-medium">Beschreibung</th>
                <th className="px-4 py-2.5 text-left text-xs text-muted-foreground uppercase tracking-wide font-medium">Kategorie</th>
                <th className="px-4 py-2.5 text-right text-xs text-muted-foreground uppercase tracking-wide font-medium">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className={`border-b border-border/50 ${row.skip ? "opacity-35" : "hover:bg-muted/20"}`} data-testid={`preview-row-${idx}`}>
                  <td className="px-4 py-2">
                    <input type="checkbox" checked={!row.skip} onChange={() => toggleSkip(idx)} className="accent-primary w-3.5 h-3.5" />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground tabular-nums text-xs whitespace-nowrap">{row.date || row.month}</td>
                  <td className="px-4 py-2 max-w-xs"><p className="truncate text-foreground text-xs">{row.description}</p></td>
                  <td className="px-3 py-2">
                    <Select value={row.categoryId ? String(row.categoryId) : ""} onValueChange={v => setCategory(idx, parseInt(v))} disabled={row.skip}>
                      <SelectTrigger className="h-7 text-xs w-40 bg-background border-border"><SelectValue placeholder="Kategorie…" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: safeCssColor(c.color) }} />{c.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-xs whitespace-nowrap">
                    <span className={row.type === "income" ? "text-green-500" : "text-red-400"}>
                      {row.type === "income" ? "+" : "−"}{fmtEUR(Math.abs(row.amount))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Offene Dokumente ───────────────────────────────────────────────────────

function DocumentsCard({ accounts, categories }: { accounts: Account[]; categories: Category[] }) {
  const { toast } = useToast();
  const [activeDocumentId, setActiveDocumentId] = useState<number | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const { data: documents, isLoading, error } = useQuery<OpenDocument[]>({ queryKey: ["/api/paperless/documents"] });

  const importMut = useMutation({
    mutationFn: (documentId: number) => apiRequest("POST", `/api/paperless/documents/${documentId}/import`).then(r => r.json()),
    onSuccess: (result: ParseResult, documentId) => {
      setActiveDocumentId(documentId);
      setParseResult(result);
    },
    onError: (e: Error) => toast({ title: "Fehler beim Laden aus Paperless", description: extractApiErrorMessage(e.message), variant: "destructive" }),
  });

  const activeDoc = documents?.find(d => d.id === activeDocumentId);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 px-6 pt-5">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Download size={14} />Offene Dokumente
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-5 space-y-3">
        {isLoading && <Loader2 size={18} className="animate-spin text-muted-foreground" />}

        {error && (
          <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">
            <AlertCircle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
            <p className="text-sm text-destructive">{extractApiErrorMessage((error as Error).message)}</p>
          </div>
        )}

        {documents && documents.length === 0 && (
          <p className="text-sm text-muted-foreground">Keine offenen Kontoauszüge in Paperless gefunden.</p>
        )}

        {documents?.map(doc => {
          const badge = statusBadge(doc.status);
          return (
            <div key={doc.id} data-testid={`paperless-document-${doc.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md bg-muted/30">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{doc.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">{fmtDate(doc.created)}</span>
                  <Badge variant={badge.variant} className="text-xs border-0 px-1.5 py-0">{badge.text}</Badge>
                </div>
              </div>
              <Button
                data-testid={`button-import-document-${doc.id}`}
                size="sm"
                variant="outline"
                disabled={doc.status === "ambiguous" || importMut.isPending}
                onClick={() => importMut.mutate(doc.id)}
              >
                {importMut.isPending && importMut.variables === doc.id ? <Loader2 size={13} className="animate-spin" /> : "Importieren"}
              </Button>
            </div>
          );
        })}

        {activeDoc && parseResult && (
          <PreviewSection
            documentId={activeDoc.id}
            parseResult={parseResult}
            accounts={accounts}
            categories={categories}
            defaultAccountId={activeDoc.accountId}
            onDone={() => { setActiveDocumentId(null); setParseResult(null); }}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Seite ──────────────────────────────────────────────────────────────────

export default function ImportPaperless() {
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 py-4 md:px-8 md:py-6 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">Aus Paperless importieren</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Kontoauszüge aus Paperless-ngx übernehmen, ohne sie erneut hochzuladen</p>
      </div>

      <div className="flex-1 p-4 md:p-8 space-y-6">
        <MappingsCard accounts={accounts} />
        <DocumentsCard accounts={accounts} categories={categories} />
      </div>
    </div>
  );
}
