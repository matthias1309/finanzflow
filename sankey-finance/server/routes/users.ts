import { Router } from "express";
import bcrypt from "bcryptjs";
import { storage } from "../storage";
import { requireAdmin } from "../auth";
import { createUserSchema, updateUserSchema, changePasswordSchema } from "@shared/schema";
import type { User, PublicUser } from "@shared/schema";

export const usersRouter = Router();

function toPublic(user: User): PublicUser {
  const { passwordHash: _ph, totpSecret: _ts, totpPendingSecret: _tp, totpLastUsedToken: _tl, ...pub } = user;
  return pub;
}

// ─── GET /api/users ───────────────────────────────────────────────────────────

usersRouter.get("/", requireAdmin, (_req, res) => {
  res.json(storage.getUsers().map(toPublic));
});

// ─── POST /api/users ──────────────────────────────────────────────────────────

usersRouter.post("/", requireAdmin, (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" });
    return;
  }

  const { username, password, isAdmin } = parsed.data;

  if (storage.getUserByUsername(username)) {
    res.status(409).json({ message: "Benutzername bereits vergeben" });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = storage.createUser({ username, passwordHash, isAdmin: isAdmin ? 1 : 0 });
  res.status(201).json(toPublic(user));
});

// ─── PATCH /api/users/:id ─────────────────────────────────────────────────────

usersRouter.patch("/:id", requireAdmin, (req, res) => {
  const id     = parseInt(req.params.id as string, 10);
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" });
    return;
  }

  const existing = storage.getUserById(id);
  if (!existing) { res.status(404).json({ message: "Benutzer nicht gefunden" }); return; }

  if (!parsed.data.isAdmin && existing.isAdmin === 1 && storage.countAdmins() <= 1) {
    res.status(409).json({ message: "Letzter Admin kann nicht degradiert werden" });
    return;
  }

  const updated = storage.updateUser(id, { isAdmin: parsed.data.isAdmin ? 1 : 0 });
  res.json(toPublic(updated!));
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────

usersRouter.delete("/:id", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id as string, 10);

  const existing = storage.getUserById(id);
  if (!existing) { res.status(404).json({ message: "Benutzer nicht gefunden" }); return; }

  if (existing.isAdmin === 1 && storage.countAdmins() <= 1) {
    res.status(409).json({ message: "Letzter Admin kann nicht gelöscht werden" });
    return;
  }

  storage.resetUserTotp(id);
  storage.deleteUser(id);
  res.status(204).send();
});

// ─── PATCH /api/users/:id/password ───────────────────────────────────────────

usersRouter.patch("/:id/password", (req, res) => {
  const id     = parseInt(req.params.id as string, 10);
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" });
    return;
  }

  const existing = storage.getUserById(id);
  if (!existing) { res.status(404).json({ message: "Benutzer nicht gefunden" }); return; }

  const { newPassword, oldPassword } = parsed.data;

  if (oldPassword !== undefined) {
    if (!bcrypt.compareSync(oldPassword, existing.passwordHash)) {
      res.status(401).json({ message: "Aktuelles Passwort falsch" });
      return;
    }
  }

  storage.updateUserPassword(id, bcrypt.hashSync(newPassword, 10));
  res.json({ ok: true });
});

// ─── POST /api/users/:id/2fa-reset ───────────────────────────────────────────

usersRouter.post("/:id/2fa-reset", requireAdmin, (req, res) => {
  const id = parseInt(req.params.id as string, 10);

  const existing = storage.getUserById(id);
  if (!existing) { res.status(404).json({ message: "Benutzer nicht gefunden" }); return; }

  storage.resetUserTotp(id);
  res.json({ ok: true });
});
