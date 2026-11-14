import express from "express";
import { z } from "zod";
import { readCookie, requireUser, SESSION_COOKIE } from "./auth.js";
import { removeFilesWhere } from "./attachments.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";
import { googleAbilities, googleStatus } from "./google.js";
import { addServer, listServers, removeServer, serverTools, setUserConnector, userConnectors } from "./mcp.js";
import { mailSettingsPublic } from "./mail.js";
import {
  assistantName, defaultFeatures, getFeatures, getPrefs, saveAssistantName, saveDefaultFeatures, saveFeatures,
  savePrefs, DEFAULT_FEATURES, VOICES,
} from "./prefs.js";
import { hashPassword, hashToken, verifyPassword } from "./security.js";

// Settings API: the user's own settings and account, and the admin's switches.
export const settingsApi = express.Router();

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) throw new AppError(400, "Invalid input.");
  return result.data;
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return next(new AppError(403, "Only the admin can do that."));
  next();
}

const LOGIN_NAME = /^[a-z0-9_-]{2,20}$/;

settingsApi.get("/settings", requireUser, (req, res) => {
  const userId = req.user.id;
  const memoryCount = db.prepare("SELECT COUNT(*) AS n FROM memories WHERE user_id = ?").get(userId).n;
  const google = googleStatus(userId);
  res.json({
    user: { username: req.user.username, isAdmin: req.user.isAdmin },
    assistantName: assistantName(),
    prefs: getPrefs(userId),
    allowed: getFeatures(userId), // what the admin allows
    features: DEFAULT_FEATURES,
    defaults: defaultFeatures(),
    connectors: userConnectors(userId),
    google: { ...google, ...googleAbilities(userId) },
    mail: mailSettingsPublic(userId),
    memoryCount,
  });
});

settingsApi.put("/settings/prefs", requireUser, (req, res) => {
  const input = parse(z.object({
    customInstructions: z.string().max(1500).optional(),
    personality: z.enum(["balanced", "concise", "detailed"]).optional(),
    language: z.enum(["auto", "de", "en"]).optional(),
    memory: z.boolean().optional(),
    webSearch: z.boolean().optional(),
    readAloud: z.boolean().optional(),
    theme: z.enum(["system", "light", "dark"]).optional(),
    voice: z.enum(VOICES).optional(),
    learnFromChats: z.boolean().optional(),
    uiLanguage: z.enum(["de", "en"]).optional(),
    uiStyle: z.enum(["classic", "koi"]).optional(),
    reasoning: z.enum(["none", "low", "medium", "high"]).optional(),
  }), req.body);
  res.json({ prefs: savePrefs(req.user.id, input) });
});

settingsApi.put("/settings/connectors/:id", requireUser, (req, res) => {
  const { enabled } = parse(z.object({ enabled: z.boolean() }), req.body);
  setUserConnector(req.user.id, req.params.id, enabled);
  res.json({ connectors: userConnectors(req.user.id) });
});

// ---- account ----

settingsApi.patch("/me", requireUser, (req, res) => {
  const { username } = parse(z.object({ username: z.string().trim().min(2).max(20) }), req.body);
  const clean = username.toLowerCase();
  if (!LOGIN_NAME.test(clean)) throw new AppError(400, "Usernames: 2-20 letters, digits, - or _.");
  const taken = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(clean, req.user.id);
  if (taken) throw new AppError(409, "That username is taken.");
  db.prepare("UPDATE users SET username = ? WHERE id = ?").run(clean, req.user.id);
  res.json({ username: clean });
});

settingsApi.post("/me/password", requireUser, (req, res) => {
  const { current, next } = parse(z.object({
    current: z.string().min(1).max(200),
    next: z.string().min(8).max(200),
  }), req.body);
  const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user.id);
  if (!verifyPassword(current, row.password_hash)) throw new AppError(403, "The current password is wrong.");
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(next), req.user.id);
  // Signed out everywhere, including this device: sign in again with the new password.
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(req.user.id);
  res.json({ ok: true });
});

// Signs out every other device; this one stays signed in.
settingsApi.post("/me/sessions/others", requireUser, (req, res) => {
  const current = hashToken(readCookie(req, SESSION_COOKIE) || "");
  const { changes } = db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?")
    .run(req.user.id, current);
  res.json({ signedOut: Number(changes) });
});

settingsApi.delete("/me/memories", requireUser, (req, res) => {
  const { changes } = db.prepare("DELETE FROM memories WHERE user_id = ?").run(req.user.id);
  res.json({ deleted: Number(changes) });
});

settingsApi.delete("/me/chats", requireUser, (req, res) => {
  removeFilesWhere("user_id = ? AND conversation_id IS NOT NULL", [req.user.id]);
  const { changes } = db.prepare("DELETE FROM conversations WHERE user_id = ?").run(req.user.id);
  res.json({ deleted: Number(changes) });
});

settingsApi.get("/me/export", requireUser, (req, res) => {
  const conversations = db.prepare("SELECT id, title, created_at FROM conversations WHERE user_id = ? ORDER BY id")
    .all(req.user.id)
    .map((c) => ({
      title: c.title,
      created_at: c.created_at,
      messages: db.prepare("SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id")
        .all(c.id),
    }));
  const memories = db.prepare("SELECT text, created_at FROM memories WHERE user_id = ? ORDER BY id").all(req.user.id);
  const notes = db.prepare("SELECT text, created_at FROM notes WHERE user_id = ? ORDER BY id").all(req.user.id);
  res.set({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": "attachment; filename=\"my-data.json\"",
    "Cache-Control": "no-store",
  });
  res.send(JSON.stringify({ exported_at: new Date().toISOString(), conversations, memories, notes }, null, 2));
});

// ---- admin ----

settingsApi.put("/admin/users/:id/features", requireUser, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare("SELECT id FROM users WHERE id = ?").get(id)) throw new AppError(404, "No such user.");
  const input = parse(z.object({
    web: z.boolean().optional(),
    memory: z.boolean().optional(),
    mail: z.boolean().optional(),
    calendar: z.boolean().optional(),
    gmail: z.boolean().optional(),
    mcp: z.boolean().optional(),
  }), req.body);
  res.json({ features: saveFeatures(id, input) });
});

settingsApi.get("/admin/connectors", requireUser, requireAdmin, (req, res) => {
  res.json({ connectors: listServers() });
});

settingsApi.post("/admin/connectors", requireUser, requireAdmin, (req, res) => {
  const input = parse(z.object({
    name: z.string().trim().min(1).max(60),
    url: z.string().trim().min(8).max(500),
    token: z.string().max(500).optional(),
  }), req.body);
  const id = addServer(input);
  res.status(201).json({ id });
});

settingsApi.delete("/admin/connectors/:id", requireUser, requireAdmin, (req, res) => {
  removeServer(req.params.id);
  res.json({ ok: true });
});

settingsApi.post("/admin/connectors/:id/test", requireUser, requireAdmin, async (req, res) => {
  const tools = await serverTools(Number(req.params.id));
  res.json({ ok: true, tools: tools.length, names: tools.slice(0, 12).map((t) => t.name) });
});

// What new users start with. Existing users keep the switches the admin already set for them.
settingsApi.put("/admin/defaults", requireUser, requireAdmin, (req, res) => {
  const input = parse(z.object({
    web: z.boolean().optional(),
    memory: z.boolean().optional(),
    mail: z.boolean().optional(),
    calendar: z.boolean().optional(),
    gmail: z.boolean().optional(),
    mcp: z.boolean().optional(),
  }), req.body);
  res.json({ defaults: saveDefaultFeatures(input) });
});

settingsApi.put("/admin/app", requireUser, requireAdmin, (req, res) => {
  const { assistantName: name } = parse(z.object({ assistantName: z.string().trim().min(1).max(40) }), req.body);
  res.json({ assistantName: saveAssistantName(name) });
});
