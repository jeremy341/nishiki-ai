import { clearAiKey, saveAiKey } from "./providers.js";
import express from "express";
import { z } from "zod";
import { chatCompletion } from "./ai.js";
import { requireUser } from "./auth.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";
import { deleteMemory, listMemories } from "./memory.js";
import { inbox, mailSettingsPublic, runMailReport, saveMailSettings } from "./mail.js";
import { usageLast24h } from "./usage.js";
import { listModels, publicAi, roleConfigured, saveRoles } from "./providers.js";
import { getFeatures } from "./prefs.js";
import { hashPassword } from "./security.js";

// Routes for memory, mail, usage, and the admin page.
export const api = express.Router();

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) throw new AppError(400, "Invalid input.");
  return result.data;
}

function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) return next(new AppError(403, "Only the admin can do that."));
  next();
}

// ---- memory ----

api.get("/memories", requireUser, (req, res) => {
  res.json({ memories: listMemories(req.user.id) });
});

api.delete("/memories/:id", requireUser, (req, res) => {
  deleteMemory(req.user.id, req.params.id);
  res.json({ ok: true });
});

// ---- mail ----

api.get("/mail/settings", requireUser, (req, res) => {
  res.json({ settings: mailSettingsPublic(req.user.id) });
});

api.put("/mail/settings", requireUser, (req, res) => {
  const input = parse(z.object({
    host: z.string().max(120).optional(),
    address: z.string().max(200).optional(),
    password: z.string().max(200).optional(),
    ntfyTopic: z.string().max(80).optional(),
    reportEnabled: z.boolean().optional(),
    consent: z.boolean().optional(),
  }), req.body);
  res.json({ settings: saveMailSettings(req.user.id, input) });
});

api.get("/mail/inbox", requireUser, async (req, res) => {
  res.json({ messages: await inbox(req.user.id) });
});

api.post("/mail/report-now", requireUser, async (req, res) => {
  res.json({ result: await runMailReport(req.user.id) });
});

// ---- usage ----

api.get("/usage/me", requireUser, (req, res) => {
  res.json({ today: usageLast24h(req.user.id) });
});

// ---- admin: users ----

api.get("/admin/users", requireUser, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT id, username, is_admin, active, created_at
    FROM users ORDER BY id
  `).all();
  res.json({
    users: rows.map((u) => ({
      id: u.id,
      username: u.username,
      isAdmin: u.is_admin === 1,
      active: u.active === 1,
      createdAt: u.created_at,
      last24h: usageLast24h(u.id),
      features: getFeatures(u.id),
    })),
  });
});

api.patch("/admin/users/:id", requireUser, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!user) throw new AppError(404, "No such user.");
  const body = parse(z.object({
    active: z.boolean().optional(),
    isAdmin: z.boolean().optional(),
    password: z.string().min(8).max(200).optional(),
  }), req.body);
  if (id === req.user.id && (body.active === false || body.isAdmin === false)) {
    throw new AppError(400, "You cannot switch off your own admin access or account.");
  }
  if (body.active !== undefined) db.prepare("UPDATE users SET active = ? WHERE id = ?").run(body.active ? 1 : 0, id);
  if (body.isAdmin !== undefined) db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(body.isAdmin ? 1 : 0, id);
  if (body.password) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(body.password), id);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  }
  if (body.active === false) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  res.json({ ok: true });
});

// ---- admin: AI models (one provider, Hack Club AI) ----

api.get("/admin/ai", requireUser, requireAdmin, (req, res) => {
  res.json(publicAi());
});

api.get("/admin/ai/models", requireUser, requireAdmin, async (req, res) => {
  res.json({ models: await listModels() });
});

api.put("/admin/ai", requireUser, requireAdmin, (req, res) => {
  res.json(saveRoles(req.body));
});

// The Hack Club key: saved encrypted in the app, never sent back.
api.put("/admin/ai/key", requireUser, requireAdmin, (req, res) => {
  const { key } = parse(z.object({ key: z.string().trim().min(10).max(300) }), req.body);
  saveAiKey(key);
  res.json(publicAi());
});

api.delete("/admin/ai/key", requireUser, requireAdmin, (req, res) => {
  clearAiKey();
  res.json(publicAi());
});

api.post("/admin/ai/test", requireUser, requireAdmin, async (req, res) => {
  const { role } = parse(z.object({ role: z.enum(["chat", "stt", "tts"]) }), req.body);
  if (!roleConfigured(role)) {
    return res.json({ ok: false, detail: "Not set up: HACKCLUB_API_KEY is missing, or no model is chosen." });
  }
  if (role !== "chat") {
    return res.json({ ok: true, detail: `${role} is configured. It is checked when used, to avoid spending on a test.` });
  }
  const answer = await chatCompletion([
    { role: "user", content: "Reply with the single word: ok" },
  ], { role: "chat", userId: req.user.id, maxTokens: 10, temperature: 0 });
  res.json({ ok: true, detail: `Hack Club AI answered: ${answer.slice(0, 40)}` });
});

// ---- admin: usage ----

api.get("/admin/usage", requireUser, requireAdmin, (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
  const window = `-${days} days`;
  const byModel = db.prepare(`
    SELECT role, provider, model, COUNT(*) AS calls,
           SUM(prompt_tokens) AS prompt_tokens, SUM(completion_tokens) AS completion_tokens
    FROM usage WHERE created_at >= datetime('now', ?)
    GROUP BY role, provider, model ORDER BY calls DESC
  `).all(window);
  const byUser = db.prepare(`
    SELECT users.username AS username, COUNT(usage.id) AS calls,
           COALESCE(SUM(usage.prompt_tokens + usage.completion_tokens), 0) AS tokens
    FROM users LEFT JOIN usage ON usage.user_id = users.id AND usage.created_at >= datetime('now', ?)
    GROUP BY users.id ORDER BY tokens DESC
  `).all(window);
  res.json({ days, byModel, byUser });
});
