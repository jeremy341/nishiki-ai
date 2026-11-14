import { randomBytes } from "node:crypto";
import express from "express";
import { config } from "./config.js";
import { requireUser } from "./auth.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";
import { assistantName } from "./prefs.js";
import { hashPassword, hashToken } from "./security.js";

// Invite-only accounts. The admin creates a link; the person opens it, picks a username and a
// password, and is signed in. A link works once and expires after a week. There are at most
// config.maxUsers accounts, and open invites count against that number.
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const USERNAME = /^[a-z0-9_-]{2,20}$/;

export const invitesApi = express.Router();

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return next(new AppError(403, "Only the admin can do that."));
  next();
}

function accountCount() {
  return db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
}

function openInviteCount() {
  return db.prepare("SELECT COUNT(*) AS n FROM invites WHERE used_at IS NULL AND expires_at > ?")
    .get(Date.now()).n;
}

function findOpenInvite(token) {
  if (typeof token !== "string" || token.length > 200) return undefined;
  return db.prepare("SELECT id FROM invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?")
    .get(hashToken(token), Date.now());
}

// Creates the account for an open invite and uses the invite up. Throws when it cannot.
export function acceptInvite(token, { username, password }) {
  if (!findOpenInvite(token)) throw new AppError(404, "This invite link is no longer valid. Ask for a new one.");
  const name = username.trim().toLowerCase();
  if (!USERNAME.test(name)) throw new AppError(400, "Usernames: 2-20 letters, digits, - or _.");
  if (db.prepare("SELECT id FROM users WHERE username = ?").get(name)) {
    throw new AppError(409, "That username is taken. Choose another.");
  }
  if (accountCount() >= config.maxUsers) throw new AppError(409, "Nishiki is full. Ask the admin for more room.");
  const { lastInsertRowid } = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
    .run(name, hashPassword(password));
  const id = Number(lastInsertRowid);
  db.prepare("UPDATE invites SET used_at = datetime('now'), used_by = ? WHERE token_hash = ?")
    .run(id, hashToken(token));
  return { id, username: name, isAdmin: false };
}

invitesApi.get("/invites/:token", (req, res) => {
  res.json({ valid: Boolean(findOpenInvite(req.params.token)), assistantName: assistantName() });
});

invitesApi.get("/admin/invites", requireUser, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT id, created_at, expires_at FROM invites
    WHERE used_at IS NULL AND expires_at > ? ORDER BY id DESC
  `).all(Date.now());
  res.json({
    invites: rows.map((r) => ({ id: r.id, createdAt: r.created_at, expiresAt: r.expires_at })),
    seats: { max: config.maxUsers, used: accountCount() + openInviteCount() },
  });
});

invitesApi.post("/admin/invites", requireUser, requireAdmin, (req, res) => {
  if (accountCount() + openInviteCount() >= config.maxUsers) {
    throw new AppError(409, `Nishiki has room for ${config.maxUsers} people. Revoke an open invite, or remove an account first.`);
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + INVITE_TTL_MS;
  const { lastInsertRowid } = db.prepare("INSERT INTO invites (token_hash, created_by, expires_at) VALUES (?, ?, ?)")
    .run(hashToken(token), req.user.id, expiresAt);
  // The link is shown once. Only its hash stays in the database.
  res.status(201).json({
    id: Number(lastInsertRowid),
    url: `${config.publicUrl}/invite/${token}`,
    expiresAt,
  });
});

invitesApi.delete("/admin/invites/:id", requireUser, requireAdmin, (req, res) => {
  const { changes } = db.prepare("DELETE FROM invites WHERE id = ? AND used_at IS NULL").run(Number(req.params.id));
  if (!changes) throw new AppError(404, "That invite does not exist or was already used.");
  res.json({ ok: true });
});
