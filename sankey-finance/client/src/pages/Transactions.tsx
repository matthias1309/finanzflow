import { safeCssColor } from "@/lib/config";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { type ZodType } from "zod";
import { insertTransactionSchema } from "@shared/schema";
import type { Transaction, Category, Account } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil } from "lucide-react";

const formSchema = insertTransactionSchema.extend({ amount: z.coerce.number().positive() });
type FormData = z.infer<typeof formSchema>;

function fmtEUR(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}
function fmtMonth(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

export default function Transactions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [filterAccountId, setFilterAccountId] = useState<string>("all");

  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"] });
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const { data: months = [] } = useQuery<string[]>({ queryKey: ["/api/months"] });
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions", selectedMonth],
    queryFn: () => apiRequest("GET", `/api/transactions?month=${selectedMonth}`).then(r => r.json()),
  });

  const allMonths = useMemo(() => [...new Set([currentMonth, ...months])].sort().reverse(), [months, currentMonth]);
  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories]);
  const accMap = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts]);

  const filtered = useMemo(() => filterAccountId === "all" ? transactions : transactions.filter(t => t.accountId === parseInt(filterAccountId)), [transactions, filterAccountId]);

  const defaultVals = { description: "", amount: 0, month: selectedMonth, accountId: accounts[0]?.id ?? 0, categoryId: null as any, type: "expense" as const, transferToAccountId: null as any, importSource: "manual", originalText: null as any, date: null as any };
  const form = useForm<FormData>({ resolver: zodResolver(formSchema as unknown as ZodType<FormData>), defaultValues: defaultVals });

  const openNew = () => { setEditTx(null); form.reset({ ...defaultVals, month: selectedMonth, accountId: accounts[0]?.id ?? 0 }); setOpen(true); };
  const openEdit = (tx: Transaction) => { setEditTx(tx); form.reset({ description: tx.description, amount: tx.amount, month: tx.month, accountId: tx.accountId, categoryId: tx.categoryId as any, type: tx.type as any, transferToAccountId: tx.transferToAccountId as any, importSource: tx.importSource as any, originalText: tx.originalText as any, date: tx.date as any }); setOpen(true); };

  const createMut = useMutation({ mutationFn: (d: FormData) => apiRequest("POST", "/api/transactions", d).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/transactions"] }); qc.invalidateQueries({ queryKey: ["/api/summary"] }); qc.invalidateQueries({ queryKey: ["/api/months"] }); setOpen(false); toast({ title: "Buchung gespeichert" }); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: number; data: FormData }) => apiRequest("PUT", `/api/transactions/${id}`, data).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/transactions"] }); qc.invalidateQueries({ queryKey: ["/api/summary"] }); setOpen(false); toast({ title: "Buchung aktualisiert" }); }, onError: (err: Error) => { toast({ title: err.message ?? "Fehler beim Speichern", variant: "destructive" }); } });
  const deleteMut = useMutation({ mutationFn: (id: number) => apiRequest("DELETE", `/api/transactions/${id}`).then(r => r.json()), onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/transactions"] }); qc.invalidateQueries({ queryKey: ["/api/summary"] }); qc.invalidateQueries({ queryKey: ["/api/months"] }); toast({ title: "Gelöscht" }); } });

  const onSubmit = (d: FormData) => editTx ? updateMut.mutate({ id: editTx.id, data: d }) : createMut.mutate(d);

  const selectedType = form.watch("type");
  const filteredCats = categories.filter(c => c.type === selectedType || c.type === "transfer");
  const totalIncome = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExp = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 py-4 md:px-8 md:py-6 border-b border-border flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Buchungen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Alle Konten · manuelle Eingabe</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterAccountId} onValueChange={setFilterAccountId}>
            <SelectTrigger className="w-40 bg-card border-border text-sm h-9">
              <SelectValue placeholder="Alle Konten" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Konten</SelectItem>
              {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}><span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: safeCssColor(a.color) }} />{a.name}</span></SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40 month-badge bg-card border-border h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allMonths.map(m => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
            </SelectContent>
          </Select>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 h-9" onClick={openNew} data-testid="button-add-transaction">
                <Plus size={13} />Neu
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border-border">
              <DialogHeader><DialogTitle>{editTx ? "Buchung bearbeiten" : "Neue Buchung"}</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                  <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem><FormLabel>Typ</FormLabel>
                      <Select value={field.value} onValueChange={v => { field.onChange(v); form.setValue("categoryId", null as any); }}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="income">Einnahme</SelectItem>
                          <SelectItem value="expense">Ausgabe</SelectItem>
                          <SelectItem value="transfer">Kontoübertrag</SelectItem>
                        </SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />

                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Beschreibung</FormLabel>
                      <FormControl><Input placeholder="z.B. Gehalt, Miete…" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem><FormLabel>Betrag (€)</FormLabel>
                      <FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <FormField control={form.control} name="accountId" render={({ field }) => (
                    <FormItem><FormLabel>Konto</FormLabel>
                      <Select value={field.value ? String(field.value) : ""} onValueChange={v => field.onChange(parseInt(v))}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Konto wählen…" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: safeCssColor(a.color) }} />{a.name}</span></SelectItem>)}
                        </SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />

                  {selectedType === "transfer" && (
                    <FormField control={form.control} name="transferToAccountId" render={({ field }) => (
                      <FormItem><FormLabel>Zielkonto</FormLabel>
                        <Select value={field.value ? String(field.value) : ""} onValueChange={v => field.onChange(parseInt(v))}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Zielkonto…" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                  )}

                  <FormField control={form.control} name="categoryId" render={({ field }) => (
                    <FormItem><FormLabel>Kategorie</FormLabel>
                      <Select value={field.value ? String(field.value) : ""} onValueChange={v => field.onChange(parseInt(v))}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Kategorie wählen…" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {filteredCats.map(c => <SelectItem key={c.id} value={String(c.id)}><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: safeCssColor(c.color) }} />{c.name}</span></SelectItem>)}
                        </SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />

                  <FormField control={form.control} name="month" render={({ field }) => (
                    <FormItem><FormLabel>Monat</FormLabel>
                      <FormControl><Input type="month" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <div className="flex gap-2 pt-1">
                    <Button type="submit" className="flex-1" disabled={createMut.isPending || updateMut.isPending}>{editTx ? "Aktualisieren" : "Speichern"}</Button>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 space-y-5">
        {/* Summary row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Einnahmen", v: totalIncome, c: "text-green-500" },
            { label: "Ausgaben", v: totalExp, c: "text-red-400" },
            { label: "Bilanz", v: totalIncome - totalExp, c: (totalIncome - totalExp) >= 0 ? "text-primary" : "text-red-400" },
          ].map(({ label, v, c }) => (
            <Card key={label} className="bg-card border-border">
              <CardContent className="pt-4 pb-3 px-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
                <p className={`tabular-nums text-lg font-semibold ${c}`}>{fmtEUR(v)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2 px-6 pt-5">
            <CardTitle className="text-sm font-semibold">{fmtMonth(selectedMonth)} · {filtered.length} Buchungen</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {isLoading ? (
              <div className="px-6 pb-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-9 bg-muted rounded animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="px-6 pb-8 pt-4 text-center">
                <p className="text-sm text-muted-foreground">Keine Buchungen für {fmtMonth(selectedMonth)}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={openNew}><Plus size={12} className="mr-1.5" />Erste Buchung</Button>
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Beschreibung", "Konto", "Kategorie", "Typ", "Betrag", ""].map(h => (
                        <th key={h} className={`px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wide ${h === "Betrag" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(tx => {
                      const cat = tx.categoryId ? catMap[tx.categoryId] : null;
                      const acc = accMap[tx.accountId];
                      return (
                        <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/25 transition-colors">
                          <td className="px-5 py-2.5 text-foreground max-w-xs truncate">{tx.description}</td>
                          <td className="px-5 py-2.5">
                            {acc ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: safeCssColor(acc.color) }} />{acc.name}</span> : "—"}
                          </td>
                          <td className="px-5 py-2.5">
                            {cat ? <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: safeCssColor(cat.color) }} />{cat.name}</span> : <span className="text-xs text-muted-foreground/50">—</span>}
                          </td>
                          <td className="px-5 py-2.5">
                            <Badge variant="secondary" className={`border-0 text-xs ${tx.type === "income" ? "bg-green-500/10 text-green-500" : tx.type === "transfer" ? "bg-blue-500/10 text-blue-400" : "bg-red-400/10 text-red-400"}`}>
                              {tx.type === "income" ? "Einnahme" : tx.type === "transfer" ? "Übertrag" : "Ausgabe"}
                            </Badge>
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums font-medium">
                            <span className={tx.type === "income" ? "text-green-500" : tx.type === "transfer" ? "text-blue-400" : "text-red-400"}>
                              {tx.type === "income" ? "+" : "−"}{fmtEUR(tx.amount)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-0.5">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(tx)}><Pencil size={12} /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMut.mutate(tx.id)}><Trash2 size={12} /></Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
