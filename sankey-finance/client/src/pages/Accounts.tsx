import { safeCssColor } from "@/lib/config";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAccountSchema } from "@shared/schema";
import type { Account } from "@shared/schema";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, Landmark } from "lucide-react";

const PRESET_COLORS = [
  "#01696f", "#437a22", "#4f98a3", "#7a39bb",
  "#a12c7b", "#006494", "#da7101", "#964219",
  "#d19900", "#a13544", "#2a9d8f", "#7a7974",
];

const BANKS = ["ING", "DKB", "N26", "Sparkasse", "Deutsche Bank", "Volksbank", "Sonstige"];
const TYPES = [
  { value: "checking", label: "Girokonto" },
  { value: "savings", label: "Tagesgeld / Sparkonto" },
  { value: "rental", label: "Mietkonto" },
  { value: "investment", label: "Depot / Investment" },
  { value: "other", label: "Sonstiges" },
];

const formSchema = insertAccountSchema.extend({});
type FormData = z.infer<typeof formSchema>;

export default function Accounts() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editAcc, setEditAcc] = useState<Account | null>(null);

  const { data: accounts = [], isLoading } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });

  const defaultValues = { name: "", bank: "ING", color: PRESET_COLORS[0], type: "checking", iban: "" };
  const form = useForm<FormData>({ resolver: zodResolver(formSchema), defaultValues });

  const createMut = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/accounts", data).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/accounts"] }); setOpen(false); form.reset(defaultValues); toast({ title: "Konto angelegt" }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) => apiRequest("PUT", `/api/accounts/${id}`, data).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/accounts"] }); setOpen(false); toast({ title: "Konto aktualisiert" }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/accounts/${id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/accounts"] }); toast({ title: "Konto gelöscht" }); },
  });

  const openNew = () => { setEditAcc(null); form.reset(defaultValues); setOpen(true); };
  const openEdit = (a: Account) => { setEditAcc(a); form.reset({ name: a.name, bank: a.bank, color: a.color, type: a.type, iban: a.iban ?? "" }); setOpen(true); };
  const onSubmit = (data: FormData) => editAcc ? updateMut.mutate({ id: editAcc.id, data }) : createMut.mutate(data);

  const typeLabel = (t: string) => TYPES.find(x => x.value === t)?.label ?? t;

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 py-4 md:px-8 md:py-6 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Konten</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Giro-, Tagesgeld- und Mietkonten verwalten</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-account" size="sm" className="gap-1.5" onClick={openNew}>
              <Plus size={14} />Neues Konto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle>{editAcc ? "Konto bearbeiten" : "Neues Konto"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Kontoname</FormLabel>
                    <FormControl><Input data-testid="input-account-name" placeholder="z.B. ING Girokonto" {...field} /></FormControl>
                    <FormMessage /></FormItem>
                )} />

                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="bank" render={({ field }) => (
                    <FormItem><FormLabel>Bank</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger data-testid="select-bank"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />

                  <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem><FormLabel>Kontotyp</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger data-testid="select-account-type"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="iban" render={({ field }) => (
                  <FormItem><FormLabel>IBAN (optional)</FormLabel>
                    <FormControl><Input data-testid="input-iban" placeholder="DE89 3704 0044 0532 0130 00" {...field} /></FormControl>
                    <FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="color" render={({ field }) => (
                  <FormItem><FormLabel>Farbe im Diagramm</FormLabel>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {PRESET_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => field.onChange(c)}
                          className={`w-7 h-7 rounded-md transition-all ${field.value === c ? "ring-2 ring-offset-2 ring-offset-card ring-white scale-110" : "opacity-70 hover:opacity-100"}`}
                          style={{ backgroundColor: c }} aria-label={c} />
                      ))}
                    </div><FormMessage /></FormItem>
                )} />

                <div className="flex gap-2 pt-1">
                  <Button data-testid="button-save-account" type="submit" className="flex-1" disabled={createMut.isPending || updateMut.isPending}>
                    {editAcc ? "Aktualisieren" : "Speichern"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 p-4 md:p-8">
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}</div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Landmark size={32} className="opacity-30" />
            <p className="text-sm">Noch keine Konten angelegt</p>
            <Button size="sm" variant="outline" onClick={openNew} className="mt-1">
              <Plus size={12} className="mr-1.5" />Erstes Konto anlegen
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map(acc => (
              <Card key={acc.id} className="bg-card border-border" data-testid={`account-card-${acc.id}`}>
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-md flex-shrink-0 mt-0.5" style={{ backgroundColor: safeCssColor(acc.color) }} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{acc.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs border-0 px-1.5 py-0">{acc.bank}</Badge>
                          <span className="text-xs text-muted-foreground">{typeLabel(acc.type)}</span>
                        </div>
                        {acc.iban && <p className="text-xs text-muted-foreground mt-1 font-mono">{acc.iban}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button data-testid={`button-edit-account-${acc.id}`} variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEdit(acc)}>
                        <Pencil size={13} />
                      </Button>
                      <Button data-testid={`button-delete-account-${acc.id}`} variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMut.mutate(acc.id)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
