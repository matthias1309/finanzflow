import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createUserSchema, changePasswordSchema } from "@shared/schema";
import type { PublicUser, CreateUserInput, ChangePasswordInput } from "@shared/schema";
import { type ZodType } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, KeyRound, ShieldOff, Users } from "lucide-react";

type CreateForm   = CreateUserInput;
type PasswordForm = ChangePasswordInput;

export default function UsersPage() {
  const { toast }  = useToast();
  const qc         = useQueryClient();

  const [addOpen,     setAddOpen]     = useState(false);
  const [pwUser,      setPwUser]      = useState<PublicUser | null>(null);
  const [deleteUser,  setDeleteUser]  = useState<PublicUser | null>(null);
  const [reset2faUser, setReset2faUser] = useState<PublicUser | null>(null);

  const { data: users = [], isLoading } = useQuery<PublicUser[]>({ queryKey: ["/api/users"] });
  const { data: me } = useQuery<{ username: string; isAdmin: boolean }>({ queryKey: ["/api/auth/me"] });

  // ── Formulare ──────────────────────────────────────────────────────────────
  const addForm = useForm<CreateForm>({
    resolver: zodResolver(createUserSchema as unknown as ZodType<CreateForm>),
    defaultValues: { username: "", password: "", isAdmin: false },
  });

  const pwForm = useForm<PasswordForm>({
    resolver: zodResolver(changePasswordSchema as unknown as ZodType<PasswordForm>),
    defaultValues: { newPassword: "", oldPassword: "" },
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (data: CreateForm) => apiRequest("POST", "/api/users", data).then(r => r.json()),
    onSuccess: (data) => {
      if (data.message) { toast({ title: data.message, variant: "destructive" }); return; }
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      setAddOpen(false);
      addForm.reset();
      toast({ title: "Benutzer angelegt" });
    },
  });

  const toggleAdminMut = useMutation({
    mutationFn: ({ id, isAdmin }: { id: number; isAdmin: boolean }) =>
      apiRequest("PATCH", `/api/users/${id}`, { isAdmin }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.message && !data.id) {
        toast({ title: data.message, variant: "destructive" });
        return;
      }
      qc.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteUser(null);
      toast({ title: "Benutzer gelöscht" });
    },
    onError: async (_, id) => {
      const res = await apiRequest("DELETE", `/api/users/${id}`).catch(() => null);
      toast({ title: "Fehler beim Löschen", variant: "destructive" });
      setDeleteUser(null);
    },
  });

  const pwMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PasswordForm }) => {
      const payload: { newPassword: string; oldPassword?: string } = { newPassword: data.newPassword };
      if (data.oldPassword) payload.oldPassword = data.oldPassword;
      return apiRequest("PATCH", `/api/users/${id}/password`, payload).then(r => r.json());
    },
    onSuccess: (data) => {
      if (data.message && !data.ok) {
        toast({ title: data.message, variant: "destructive" });
        return;
      }
      setPwUser(null);
      pwForm.reset();
      toast({ title: "Passwort gesetzt" });
    },
    onError: (err: Error) => {
      toast({ title: err.message ?? "Fehler beim Speichern", variant: "destructive" });
    },
  });

  const reset2faMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/users/${id}/2fa-reset`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      setReset2faUser(null);
      toast({ title: "2FA zurückgesetzt" });
    },
  });

  const isLastAdmin = (u: PublicUser) => u.isAdmin === 1 && users.filter(x => x.isAdmin === 1).length <= 1;

  return (
    <div className="flex flex-col flex-1">
      <div className="px-4 py-4 md:px-8 md:py-6 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Benutzerverwaltung</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Benutzer anlegen, Rechte vergeben und Passwörter setzen</p>
        </div>
        <Button data-testid="button-add-user" size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus size={14} />Benutzer anlegen
        </Button>
      </div>

      <div className="flex-1 p-4 md:p-8">
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded animate-pulse" />)}</div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Users size={32} className="opacity-30" />
            <p className="text-sm">Keine Benutzer gefunden</p>
          </div>
        ) : (
          <div data-testid="users-list" className="space-y-3">
            {users.map(user => (
              <Card key={user.id} className="bg-card border-border" data-testid={`user-item-${user.username}`}>
                <CardContent className="pt-4 pb-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{user.username}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {user.isAdmin === 1 && (
                            <Badge data-testid="badge-admin" variant="secondary" className="text-xs border-0 px-1.5 py-0">Admin</Badge>
                          )}
                          {user.totpEnabled === 1 ? (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 text-green-600 border-green-200">2FA aktiv</Badge>
                          ) : (
                            <Badge data-testid="badge-totp-inactive" variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">2FA inaktiv</Badge>
                          )}
                          {user.username === me?.username && (
                            <span className="text-xs text-muted-foreground">(du)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Admin</span>
                        <Switch
                          data-testid="toggle-admin"
                          checked={user.isAdmin === 1}
                          disabled={isLastAdmin(user)}
                          onCheckedChange={(checked) => toggleAdminMut.mutate({ id: user.id, isAdmin: checked })}
                        />
                      </div>

                      <Button
                        data-testid={`button-set-password-${user.username}`}
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Passwort setzen"
                        onClick={() => { setPwUser(user); pwForm.reset({ newPassword: "", oldPassword: "" }); }}
                      >
                        <KeyRound size={13} />
                      </Button>

                      {user.totpEnabled === 1 && (
                        <Button
                          data-testid="button-reset-2fa"
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-orange-500"
                          title="2FA zurücksetzen"
                          onClick={() => setReset2faUser(user)}
                        >
                          <ShieldOff size={13} />
                        </Button>
                      )}

                      <Button
                        data-testid={`button-delete-user-${user.username}`}
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={isLastAdmin(user)}
                        onClick={() => setDeleteUser(user)}
                      >
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

      {/* ── Dialog: Benutzer anlegen ────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Neuen Benutzer anlegen</DialogTitle></DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(data => createMut.mutate(data))} className="space-y-4 pt-2">
              <FormField control={addForm.control} name="username" render={({ field }) => (
                <FormItem><FormLabel>Benutzername</FormLabel>
                  <FormControl><Input data-testid="input-username" placeholder="z.B. lisa" {...field} /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={addForm.control} name="password" render={({ field }) => (
                <FormItem><FormLabel>Initiales Passwort</FormLabel>
                  <FormControl><Input data-testid="input-password" type="password" placeholder="mind. 8 Zeichen" {...field} /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <FormField control={addForm.control} name="isAdmin" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="!mt-0">Admin-Rechte</FormLabel>
                </FormItem>
              )} />
              <div className="flex gap-2 pt-1">
                <Button data-testid="button-save-user" type="submit" className="flex-1" disabled={createMut.isPending}>Anlegen</Button>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Abbrechen</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Passwort setzen ─────────────────────────────────────────── */}
      <Dialog open={!!pwUser} onOpenChange={(o) => { if (!o) setPwUser(null); }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Passwort setzen – {pwUser?.username}</DialogTitle>
          </DialogHeader>
          <Form {...pwForm}>
            <form onSubmit={pwForm.handleSubmit(data => pwMut.mutate({ id: pwUser!.id, data }))} className="space-y-4 pt-2">
              {pwUser?.username === me?.username && (
                <FormField control={pwForm.control} name="oldPassword" render={({ field }) => (
                  <FormItem><FormLabel>Aktuelles Passwort</FormLabel>
                    <FormControl><Input type="password" placeholder="Aktuelles Passwort" {...field} /></FormControl>
                    <FormMessage /></FormItem>
                )} />
              )}
              <FormField control={pwForm.control} name="newPassword" render={({ field }) => (
                <FormItem><FormLabel>Neues Passwort</FormLabel>
                  <FormControl><Input data-testid="input-new-password" type="password" placeholder="mind. 8 Zeichen" {...field} /></FormControl>
                  <FormMessage /></FormItem>
              )} />
              <div className="flex gap-2 pt-1">
                <Button data-testid="button-save-password" type="submit" className="flex-1" disabled={pwMut.isPending}>Speichern</Button>
                <Button type="button" variant="outline" onClick={() => setPwUser(null)}>Abbrechen</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: Benutzer löschen ───────────────────────────────────── */}
      <AlertDialog open={!!deleteUser} onOpenChange={(o) => { if (!o) setDeleteUser(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Benutzer löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Benutzer <strong>{deleteUser?.username}</strong> wird dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMut.mutate(deleteUser!.id)}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── AlertDialog: 2FA zurücksetzen ───────────────────────────────────── */}
      <AlertDialog open={!!reset2faUser} onOpenChange={(o) => { if (!o) setReset2faUser(null); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>2FA zurücksetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der TOTP-Code und alle Recovery-Codes von <strong>{reset2faUser?.username}</strong> werden gelöscht.
              Beim nächsten Login muss 2FA neu eingerichtet werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-reset-2fa"
              onClick={() => reset2faMut.mutate(reset2faUser!.id)}
            >
              Zurücksetzen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
