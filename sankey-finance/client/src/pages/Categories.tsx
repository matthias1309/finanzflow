import { safeCssColor } from "@/lib/config";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCategorySchema } from "@shared/schema";
import type { Category } from "@shared/schema";
import { type ZodType } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil } from "lucide-react";

const PRESET_COLORS = [
  "#437a22", "#6daa45", "#4f98a3", "#01696f",
  "#a12c7b", "#da7101", "#964219", "#006494",
  "#d19900", "#a13544", "#7a39bb", "#7a7974",
];

// Explicit type to work around drizzle-zod v0.8 / Zod v3 type inference mismatch
type FormData = { name: string; type: "income" | "expense" | "transfer"; color: string };

const defaultValues: FormData = { name: "", type: "expense", color: PRESET_COLORS[4] };

export default function Categories() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useQuery<Category[]>({ queryKey: ["/api/categories"] });

  const form = useForm<FormData>({ resolver: zodResolver(insertCategorySchema as unknown as ZodType<FormData>), defaultValues });

  const createMut = useMutation({
    mutationFn: (data: FormData) => apiRequest("POST", "/api/categories", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/categories"] });
      setOpen(false);
      form.reset(defaultValues);
      toast({ title: "Kategorie erstellt" });
    },
  });

  const editMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormData }) =>
      apiRequest("PUT", `/api/categories/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/categories"] });
      qc.invalidateQueries({ queryKey: ["/api/summary"] });
      setOpen(false);
      toast({ title: "Kategorie gespeichert" });
    },
    onError: (err: Error) => { toast({ title: err.message ?? "Fehler beim Speichern", variant: "destructive" }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/categories/${id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Kategorie gelöscht" });
    },
  });

  const openNew = () => { setEditCat(null); form.reset(defaultValues); setOpen(true); };
  const openEdit = (cat: Category) => { setEditCat(cat); form.reset({ name: cat.name, type: cat.type as FormData["type"], color: cat.color }); setOpen(true); };
  const onSubmit = (data: FormData) => editCat ? editMut.mutate({ id: editCat.id, data }) : createMut.mutate(data);

  const income = categories.filter(c => c.type === "income");
  const expenses = categories.filter(c => c.type === "expense");

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 py-4 md:px-8 md:py-6 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Kategorien</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Einnahmen- und Ausgabenkategorien verwalten</p>
        </div>

        <Dialog open={open} onOpenChange={open => { setOpen(open); if (!open) setEditCat(null); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-category" size="sm" className="gap-1.5" onClick={openNew}>
              <Plus size={14} />
              Neue Kategorie
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editCat ? "Kategorie bearbeiten" : "Neue Kategorie"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input data-testid="input-cat-name" placeholder="z.B. Lebensmittel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Typ</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-cat-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="income">Einnahme</SelectItem>
                        <SelectItem value="expense">Ausgabe</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="color" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Farbe</FormLabel>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {PRESET_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          data-testid={`color-${color}`}
                          onClick={() => field.onChange(color)}
                          className={`w-7 h-7 rounded-md transition-all ${field.value === color ? "ring-2 ring-offset-2 ring-offset-card ring-white scale-110" : "opacity-70 hover:opacity-100"}`}
                          style={{ backgroundColor: color }}
                          aria-label={color}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="flex gap-2 pt-1">
                  <Button
                    data-testid="button-save-category"
                    type="submit"
                    className="flex-1"
                    disabled={createMut.isPending || editMut.isPending}
                  >
                    {editCat ? "Speichern" : "Erstellen"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 p-4 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-green-400">
                Einnahme-Kategorien ({income.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {isLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-9 bg-muted rounded animate-pulse" />)}
                </div>
              ) : income.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Keine Kategorien</p>
              ) : (
                <CategoryList items={income} onEdit={openEdit} onDelete={id => deleteMut.mutate(id)} />
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2 px-5 pt-5">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-red-400">
                Ausgabe-Kategorien ({expenses.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {isLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-9 bg-muted rounded animate-pulse" />)}
                </div>
              ) : expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Keine Kategorien</p>
              ) : (
                <CategoryList items={expenses} onEdit={openEdit} onDelete={id => deleteMut.mutate(id)} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CategoryList({ items, onEdit, onDelete }: { items: Category[]; onEdit: (cat: Category) => void; onDelete: (id: number) => void }) {
  return (
    <div className="space-y-1.5">
      {items.map(cat => (
        <div
          key={cat.id}
          className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md hover:bg-muted/40 group"
          data-testid={`cat-item-${cat.id}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: safeCssColor(cat.color) }} />
            <span className="text-sm text-foreground">{cat.name}</span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
            <Button
              data-testid={`button-edit-cat-${cat.id}`}
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(cat)}
            >
              <Pencil size={12} />
            </Button>
            <Button
              data-testid={`button-delete-cat-${cat.id}`}
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(cat.id)}
            >
              <Trash2 size={12} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
