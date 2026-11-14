import fs from "node:fs";
import path from "node:path";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { chatCompletion } from "./ai.js";
import { memoryBlock } from "./memory.js";
import { mailConsented } from "./mail.js";
import { startScheduler } from "./scheduler.js";
import { api as apiRouter } from "./routes.js";
import { settingsApi } from "./settings-api.js";
import { libraryApi } from "./library-api.js";
import { tasksApi } from "./scheduled.js";
import { acceptInvite, invitesApi } from "./invites.js";
import { removeFilesWhere, wordAsPdf } from "./attachments.js";
import { makePdf } from "./pdf.js";
import { connectorSpecs } from "./mcp.js";
import {
  appOn, connectWithToken, disconnectToken, enableGoogleApps, listApps, setApp, usableAppIds,
} from "./apps.js";
import { learnFromChat } from "./recall.js";
import { answerConversation, exaAvailable } from "./answer.js";
import { suggestionsFor } from "./suggestions.js";
import { assistantName, getFeatures, getPrefs } from "./prefs.js";
import { resolveRole, roleConfigured } from "./providers.js";
import {
  attachmentFor, attachmentsByMessage, linkToMessage, MAX_ATTACHMENT_BYTES, textFor,
  MAX_ATTACHMENTS_PER_MESSAGE, storeUpload, unlinkMessage,
} from "./attachments.js";
import { buildModelInput } from "./context.js";
import { runAgent } from "./agent.js";
import { executeAction, localNow } from "./tools.js";
import { transcribe } from "./transcribe.js";
import { config, isSecureContext } from "./config.js";
import { db, purgeExpired } from "./db.js";
import {
  createSession, currentUser, destroySession, requireJson, requireUser,
} from "./auth.js";
import { AppError } from "./errors.js";
import {
  createEvent, disconnectGoogle, finishConnect, googleConfigured, googleStatus,
  listUpcomingEvents, consumeState, startConnect,
} from "./google.js";
import { serverTtsConfigured, synthesizeSpeech, ttsFormat } from "./tts.js";
import { burnPasswordTime, verifyPassword } from "./security.js";

purgeExpired();
setInterval(purgeExpired, 60 * 60 * 1000).unref();

const app = express();
app.disable("x-powered-by");
// Runs behind one local reverse proxy (Caddy/Nginx). Makes rate limits use the real client IP.
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      // Only on HTTPS: otherwise local http:// assets get rewritten to https:// and break.
      upgradeInsecureRequests: isSecureContext ? [] : null,
    },
  },
}));
// Large enough for one base64-encoded 6 MB attachment; every other route is tiny.
app.use(express.json({ limit: "9mb" }));
app.use("/api", requireJson);

const limit = (windowMs, max) => rateLimit({
  windowMs,
  limit: max,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment." },
});
const loginLimiter = limit(15 * 60 * 1000, 10);
const chatLimiter = limit(60 * 1000, 20);
const voiceLimiter = limit(60 * 1000, 30);
const uploadLimiter = limit(60 * 1000, 30);
const transcribeLimiter = limit(60 * 1000, 40);

// ---- helpers ----

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) throw new AppError(400, "Invalid input.");
  return result.data;
}

const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function validTimeZone(zone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

// Interprets a "YYYY-MM-DDTHH:mm" wall-clock time in the given zone as a real instant.
function localToInstant(local, zone) {
  const asUtc = Date.parse(`${local}:00Z`);
  const offsetOf = (ms) => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
    );
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - ms;
  };
  const first = asUtc - offsetOf(asUtc);
  return new Date(asUtc - offsetOf(first));
}

function nowInZone(zone) {
  return new Date().toLocaleString("sv-SE", { timeZone: zone }).replace(" ", "T").slice(0, 16);
}

function messageRow(row, attachments = []) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    created_at: row.created_at,
    attachments,
    sources: parseSources(row.sources),
    widgets: parseWidgets(row.widgets),
    activity: parseList(row.activity),
  };
}

function parseList(raw) {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.slice(0, 8).map(String) : [];
  } catch {
    return [];
  }
}

function conversationRow(row) {
  return {
    id: row.id,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at,
    pinned: Boolean(row.pinned),
    projectId: row.project_id ?? null,
  };
}

// Only ever returns a chat that belongs to this user.
function ownConversation(userId, rawId) {
  const id = Number(rawId);
  const row = Number.isInteger(id) && id > 0
    ? db.prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?").get(id, userId)
    : undefined;
  if (!row) throw new AppError(404, "Chat not found.");
  return id;
}

// Actions still waiting for a tap, for the chat screen.
function pendingForConversation(userId, conversationId) {
  return db.prepare(`
    SELECT id, kind, title, details FROM pending_actions
    WHERE user_id = ? AND conversation_id = ? AND status = 'pending' ORDER BY id
  `).all(userId, conversationId);
}

function pendingByIds(ids) {
  if (!ids.length) return [];
  const marks = ids.map(() => "?").join(",");
  return db.prepare(`SELECT id, kind, title, details FROM pending_actions WHERE id IN (${marks}) AND status = 'pending'`)
    .all(...ids);
}

function modelName() {
  try {
    return resolveRole("chat").model;
  } catch {
    return "";
  }
}

function parseWidgets(raw) {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function parseSources(raw) {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

const AUDIO_MIME = { mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac", opus: "audio/ogg" };

// ---- public + session routes ----

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Someone with an invite link picks a username and a password, and is signed in at once.
app.post("/api/invites/:token/accept", loginLimiter, (req, res) => {
  const body = parse(z.object({
    username: z.string().trim().min(2).max(20),
    password: z.string().min(8).max(200),
  }), req.body);
  const user = acceptInvite(req.params.token, body);
  createSession(res, user.id);
  res.status(201).json({ user: { id: user.id, username: user.username, isAdmin: false } });
});

app.post("/api/login", loginLimiter, (req, res) => {
  const { username, password } = parse(z.object({
    username: z.string().trim().min(2).max(20),
    password: z.string().min(1).max(200),
  }), req.body);

  const row = db.prepare("SELECT id, username, password_hash, is_admin, active FROM users WHERE username = ?")
    .get(username.toLowerCase());
  if (!row) {
    burnPasswordTime(password);
    throw new AppError(401, "Wrong username or password.");
  }
  if (!verifyPassword(password, row.password_hash)) {
    throw new AppError(401, "Wrong username or password.");
  }
  if (row.active !== 1) throw new AppError(403, "This account is switched off. Ask the admin.");
  createSession(res, row.id);
  res.json({ user: { id: row.id, username: row.username, isAdmin: row.is_admin === 1 } });
});

app.post("/api/logout", (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

app.get("/api/me", (req, res) => {
  const user = currentUser(req);
  res.json({
    user,
    assistantName: config.assistantName,
    features: {
      ai: roleConfigured("chat"),
      model: modelName(),
      speechIn: roleConfigured("stt"),
      exa: exaAvailable(),
      google: googleConfigured(),
      serverTts: serverTtsConfigured(),
      maxAttachmentMb: MAX_ATTACHMENT_BYTES / (1024 * 1024),
    },
    google: user ? googleStatus(user.id) : null,
    prefs: user ? pickPrefs(getPrefs(user.id)) : null,
    calendarApp: user ? appOn(user.id, "calendar") : false,
  });
});

// The few preferences the app needs at start-up.
function pickPrefs({ theme, readAloud, voice, uiLanguage, uiStyle, reasoning }) {
  return { theme, readAloud, voice, uiLanguage, uiStyle, reasoning };
}

// ---- attachments (photos and PDFs) ----

app.post("/api/attachments", requireUser, uploadLimiter, async (req, res) => {
  const { name, mime, data } = parse(z.object({
    name: z.string().trim().min(1).max(200),
    mime: z.string().min(3).max(100),
    data: z.string().min(1).max(Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3) + 16),
  }), req.body);
  const attachment = await storeUpload({ userId: req.user.id, name, mime, base64: data });
  res.status(201).json({ attachment });
});

// Plain text of a Word, CSV or text file, for the viewer.
app.get("/api/attachments/:id/text", requireUser, (req, res) => {
  const id = Number(req.params.id);
  const row = Number.isInteger(id) && id > 0 ? textFor(req.user.id, id) : undefined;
  if (!row) throw new AppError(404, "Attachment not found.");
  res.json({ name: row.name, kind: row.kind, text: row.text || "" });
});

// A Word file as a PDF, kept as a new file next to it.
app.post("/api/attachments/:id/pdf", requireUser, uploadLimiter, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new AppError(404, "No Word file with that id.");
  const attachment = await wordAsPdf(req.user.id, id);
  res.status(201).json({ attachment });
});

app.get("/api/attachments/:id", requireUser, (req, res) => {
  const id = Number(req.params.id);
  const row = Number.isInteger(id) && id > 0 ? attachmentFor(req.user.id, id) : undefined;
  if (!row) throw new AppError(404, "Attachment not found.");
  res.set({
    "Content-Type": row.mime,
    "Content-Disposition": "inline",
    "Cache-Control": "private, max-age=86400",
  });
  res.send(row.data);
});

// ---- conversations (persistent chats) ----

// Search over the user's chats: titles, and the text of every message.
function snippetAround(text, q) {
  const clean = String(text || "").replace(/s+/g, " ");
  const at = clean.toLowerCase().indexOf(q.toLowerCase());
  const start = Math.max(0, (at < 0 ? 0 : at) - 60);
  return (start > 0 ? "…" : "") + clean.slice(start, start + 160);
}

app.get("/api/conversations/search", requireUser, (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 100);
  if (!q) return res.json({ results: [] });
  const pattern = "%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
  const byTitle = db.prepare(`
    SELECT id, title, updated_at FROM conversations
    WHERE user_id = ? AND title LIKE ? ESCAPE '\\' ORDER BY updated_at DESC LIMIT 20
  `).all(req.user.id, pattern);
  const byText = db.prepare(`
    SELECT c.id, c.title, c.updated_at, m.content FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE c.user_id = ? AND m.content LIKE ? ESCAPE '\\' ORDER BY m.id DESC LIMIT 60
  `).all(req.user.id, pattern);
  const results = new Map();
  for (const row of byTitle) results.set(row.id, { id: row.id, title: row.title, updatedAt: row.updated_at, snippet: "" });
  for (const row of byText) {
    if (!results.has(row.id)) results.set(row.id, { id: row.id, title: row.title, updatedAt: row.updated_at, snippet: snippetAround(row.content, q) });
  }
  res.json({ results: [...results.values()].slice(0, 25) });
});

app.get("/api/conversations", requireUser, (req, res) => {
  const rows = db.prepare(`
    SELECT id, title, created_at, updated_at, pinned, project_id FROM conversations
    WHERE user_id = ? ORDER BY pinned DESC, updated_at DESC, id DESC LIMIT 200
  `).all(req.user.id);
  res.json({ conversations: rows.map(conversationRow) });
});

app.post("/api/conversations", requireUser, (req, res) => {
  const { projectId } = parse(z.object({ projectId: z.number().int().positive().nullable().optional() }), req.body || {});
  if (projectId) {
    const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id);
    if (!project) throw new AppError(404, "Project not found.");
  }
  const { lastInsertRowid } = db.prepare("INSERT INTO conversations (user_id, project_id) VALUES (?, ?)")
    .run(req.user.id, projectId || null);
  const row = db.prepare("SELECT id, title, created_at, updated_at, pinned, project_id FROM conversations WHERE id = ?")
    .get(Number(lastInsertRowid));
  res.status(201).json({ conversation: conversationRow(row) });
});

app.patch("/api/conversations/:id", requireUser, (req, res) => {
  const id = ownConversation(req.user.id, req.params.id);
  const input = parse(z.object({
    title: z.string().trim().min(1).max(120).optional(),
    pinned: z.boolean().optional(),
    projectId: z.number().int().positive().nullable().optional(),
  }), req.body);
  if (input.title !== undefined) db.prepare("UPDATE conversations SET title = ? WHERE id = ?").run(input.title, id);
  if (input.pinned !== undefined) {
    db.prepare("UPDATE conversations SET pinned = ? WHERE id = ?").run(input.pinned ? 1 : 0, id);
  }
  if (input.projectId !== undefined) {
    if (input.projectId !== null) {
      const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(input.projectId, req.user.id);
      if (!project) throw new AppError(404, "Project not found.");
    }
    db.prepare("UPDATE conversations SET project_id = ? WHERE id = ?").run(input.projectId, id);
  }
  const row = db.prepare("SELECT id, title, created_at, updated_at, pinned, project_id FROM conversations WHERE id = ?").get(id);
  res.json({ conversation: conversationRow(row) });
});

app.delete("/api/conversations/:id", requireUser, (req, res) => {
  const id = ownConversation(req.user.id, req.params.id);
  removeFilesWhere("conversation_id = ?", [id]);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  res.json({ ok: true });
});

// A short summary of a Word, PowerPoint, CSV or text file: a new chat with the text and the question.
app.post("/api/attachments/:id/summary", requireUser, chatLimiter, async (req, res) => {
  const id = Number(req.params.id);
  const row = Number.isInteger(id) && id > 0 ? textFor(req.user.id, id) : undefined;
  if (!row || !row.text) throw new AppError(400, "There is no text to summarise in this file.");
  const { lastInsertRowid } = db.prepare("INSERT INTO conversations (user_id, title) VALUES (?, ?)")
    .run(req.user.id, `Zusammenfassung: ${row.name}`.slice(0, 120));
  const conversationId = Number(lastInsertRowid);
  const question = db.prepare("INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, 'user', ?)")
    .run(req.user.id, conversationId, `Fasse das Dokument „${row.name}“ zusammen: die Kernaussagen als kurze Stichpunkte, danach wichtige Zahlen, Termine und offene Fragen.\n\n---\n${row.text.slice(0, 30000)}`);
  await answerConversation({ userId: req.user.id, conversationId, titleMessage: null, userMessageId: Number(question.lastInsertRowid) });
  res.status(201).json({ conversationId });
});

// The whole chat as a PDF: each message with who wrote it.
app.get("/api/conversations/:id/export.pdf", requireUser, async (req, res) => {
  const conversationId = ownConversation(req.user.id, req.params.id);
  const conv = db.prepare("SELECT title FROM conversations WHERE id = ?").get(conversationId);
  const body = messagesFor(req.user.id, conversationId).messages
    .map((m) => `${m.role === "user" ? "Du" : "Assistent"}:\n${m.content || ""}`)
    .join("\n\n");
  const title = conv?.title || "Chat";
  const bytes = await makePdf(title, body.slice(0, 200000));
  const file = (title.replace(/[^\w -]+/g, "").trim().slice(0, 60) || "chat") + ".pdf";
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file}"` });
  res.send(bytes);
});

// Saves one text (an answer, for example) as a note.
app.post("/api/notes", requireUser, (req, res) => {
  const { text } = parse(z.object({ text: z.string().trim().min(1).max(2000) }), req.body);
  const { lastInsertRowid } = db.prepare("INSERT INTO notes (user_id, text) VALUES (?, ?)").run(req.user.id, text);
  res.status(201).json({ id: Number(lastInsertRowid) });
});

app.get("/api/conversations/:id/messages", requireUser, (req, res) => {
  const id = ownConversation(req.user.id, req.params.id);
  const rows = db.prepare(
    "SELECT id, role, content, created_at, sources, widgets, activity FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 2000",
  ).all(id).reverse();
  const files = attachmentsByMessage(id);
  res.json({
    messages: rows.map((row) => messageRow(row, files.get(row.id) || [])),
    actions: pendingForConversation(req.user.id, id),
  });
});

app.post("/api/conversations/:id/messages", requireUser, chatLimiter, async (req, res) => {
  const conversationId = ownConversation(req.user.id, req.params.id);
  const { message, attachmentIds, useCalendar } = parse(z.object({
    message: z.string().trim().max(4000),
    attachmentIds: z.array(z.number().int().positive()).max(MAX_ATTACHMENTS_PER_MESSAGE).optional(),
    useCalendar: z.boolean().optional(),
  }), req.body);
  const ids = [...new Set(attachmentIds || [])];
  if (!message && !ids.length) throw new AppError(400, "Write a message or attach a file.");

  const userId = req.user.id;
  const inserted = db.prepare(
    "INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, 'user', ?)",
  ).run(userId, conversationId, message);
  const userMessageId = Number(inserted.lastInsertRowid);

  try {
    linkToMessage({ userId, ids, messageId: userMessageId, conversationId });

    const names = (attachmentsByMessage(conversationId).get(userMessageId) || []).map((f) => f.name);
    const { assistantId, actionIds } = await answerConversation({
      userId, conversationId, useCalendar, titleMessage: message, attachmentNames: names, userMessageId,
    });
    const row = db.prepare("SELECT id, role, content, created_at, sources, widgets, activity FROM messages WHERE id = ?").get(assistantId);
    res.json({
      message: messageRow(row, attachmentsByMessage(conversationId).get(assistantId) || []),
      actions: pendingByIds(actionIds),
    });
  } catch (error) {
    // A question that got no answer stays out of the history, and its files go back to "unsent".
    unlinkMessage(userMessageId);
    db.prepare("DELETE FROM messages WHERE id = ?").run(userMessageId);
    throw error;
  }
});

// The whole conversation as the chat screen needs it.
function messagesFor(userId, conversationId) {
  const rows = db.prepare(
    "SELECT id, role, content, created_at, sources, widgets, activity FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 2000",
  ).all(conversationId).reverse();
  const files = attachmentsByMessage(conversationId);
  return {
    messages: rows.map((row) => messageRow(row, files.get(row.id) || [])),
    actions: pendingForConversation(userId, conversationId),
  };
}

function ownMessage(userId, rawId) {
  const id = Number(rawId);
  const row = Number.isInteger(id) && id > 0
    ? db.prepare(`
      SELECT m.id, m.role, m.conversation_id FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE m.id = ? AND c.user_id = ?
    `).get(id, userId)
    : undefined;
  if (!row) throw new AppError(404, "Message not found.");
  return row;
}

// Deletes a message and everything after it in the chat, with their files.
function dropMessagesFrom(conversationId, fromId) {
  removeFilesWhere("message_id IN (SELECT id FROM messages WHERE conversation_id = ? AND id >= ?)", [conversationId, fromId]);
  db.prepare("DELETE FROM messages WHERE conversation_id = ? AND id >= ?").run(conversationId, fromId);
}

// Edit a question: the question and everything after it are replaced, and the assistant answers again.
// The question's files stay attached to the edited question.
app.patch("/api/messages/:id", requireUser, chatLimiter, async (req, res) => {
  const { content } = parse(z.object({ content: z.string().trim().min(1).max(4000) }), req.body);
  const row = ownMessage(req.user.id, req.params.id);
  if (row.role !== "user") throw new AppError(400, "Only a question can be edited.");
  const userId = req.user.id;
  const conversationId = row.conversation_id;
  const keep = db.prepare("SELECT id FROM attachments WHERE message_id = ?").all(row.id).map((r) => r.id);
  db.prepare("UPDATE attachments SET message_id = NULL, conversation_id = NULL WHERE message_id = ?").run(row.id);
  dropMessagesFrom(conversationId, row.id);
  const { lastInsertRowid } = db.prepare(
    "INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, 'user', ?)",
  ).run(userId, conversationId, content);
  const newId = Number(lastInsertRowid);
  linkToMessage({ userId, ids: keep, messageId: newId, conversationId });
  await answerConversation({ userId, conversationId, userMessageId: newId });
  res.json(messagesFor(userId, conversationId));
});

// Generate the answer again: the last answer is replaced by a new one to the same question.
app.post("/api/messages/:id/regenerate", requireUser, chatLimiter, async (req, res) => {
  const row = ownMessage(req.user.id, req.params.id);
  if (row.role !== "assistant") throw new AppError(400, "Only an answer can be generated again.");
  const question = db.prepare(
    "SELECT id FROM messages WHERE conversation_id = ? AND role = 'user' AND id < ? ORDER BY id DESC LIMIT 1",
  ).get(row.conversation_id, row.id);
  if (!question) throw new AppError(400, "There is no question to answer again.");
  dropMessagesFrom(row.conversation_id, row.id);
  await answerConversation({ userId: req.user.id, conversationId: row.conversation_id });
  res.json(messagesFor(req.user.id, row.conversation_id));
});

// ---- confirmations: the assistant proposes, the user decides ----

function ownPending(userId, rawId) {
  const id = Number(rawId);
  const row = Number.isInteger(id) && id > 0
    ? db.prepare("SELECT * FROM pending_actions WHERE id = ? AND user_id = ? AND status = 'pending'").get(id, userId)
    : undefined;
  if (!row) throw new AppError(404, "This action is no longer waiting for confirmation.");
  return row;
}

app.post("/api/actions/:id/confirm", requireUser, async (req, res) => {
  const action = ownPending(req.user.id, req.params.id);
  // Claim it first, so a double tap cannot run it twice.
  const claimed = db.prepare("UPDATE pending_actions SET status = 'running' WHERE id = ? AND status = 'pending'")
    .run(action.id);
  if (!claimed.changes) throw new AppError(409, "This action was already handled.");
  let text;
  try {
    text = await executeAction(action, req.user.id);
    db.prepare("UPDATE pending_actions SET status = 'done' WHERE id = ?").run(action.id);
  } catch (error) {
    // Put it back, so the user can try again.
    db.prepare("UPDATE pending_actions SET status = 'pending' WHERE id = ?").run(action.id);
    throw error;
  }
  const { lastInsertRowid } = db.prepare(
    "INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)",
  ).run(req.user.id, action.conversation_id, text);
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(action.conversation_id);
  const row = db.prepare("SELECT id, role, content, created_at FROM messages WHERE id = ?")
    .get(Number(lastInsertRowid));
  res.json({ message: messageRow(row, []) });
});

app.post("/api/actions/:id/cancel", requireUser, (req, res) => {
  const action = ownPending(req.user.id, req.params.id);
  db.prepare("UPDATE pending_actions SET status = 'cancelled' WHERE id = ?").run(action.id);
  res.json({ ok: true });
});

// ---- voice ----

app.get("/api/suggestions", requireUser, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  res.json({ items: await suggestionsFor(req.user.id) });
});

app.get("/api/apps", requireUser, (req, res) => {
  res.json(listApps(req.user.id));
});

app.put("/api/apps/:id", requireUser, (req, res) => {
  const { enabled } = parse(z.object({ enabled: z.boolean() }), req.body);
  setApp(req.user.id, req.params.id, enabled);
  res.json(listApps(req.user.id));
});

// Paste-a-token apps: checked against the service, then stored encrypted.
app.put("/api/apps/:id/token", requireUser, async (req, res) => {
  const { token } = parse(z.object({ token: z.string().max(500) }), req.body);
  const account = await connectWithToken(req.user.id, req.params.id, token);
  res.json({ account, ...listApps(req.user.id) });
});

app.delete("/api/apps/:id/token", requireUser, (req, res) => {
  disconnectToken(req.user.id, req.params.id);
  res.json(listApps(req.user.id));
});

app.post("/api/tts", requireUser, voiceLimiter, async (req, res) => {
  const { text } = parse(z.object({ text: z.string().trim().min(1).max(2000) }), req.body);
  const audio = await synthesizeSpeech(text, getPrefs(req.user.id).voice);
  res.set({
    "Content-Type": AUDIO_MIME[ttsFormat()] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.send(audio);
});

// Speech-to-text. Audio must be WAV; up to about 2 minutes of 16 kHz mono speech.
app.post("/api/transcribe", requireUser, transcribeLimiter, async (req, res) => {
  const { audio } = parse(z.object({ audio: z.string().min(100).max(6_500_000) }), req.body);
  const bytes = Buffer.from(audio, "base64");
  const isWav = bytes.length > 44 && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WAVE";
  if (!isWav) throw new AppError(400, "Audio must be a WAV file.");
  res.json({ text: await transcribe(audio, req.user.id) });
});

// ---- Google Calendar ----

app.get("/api/google/connect", requireUser, (req, res) => {
  if (!googleConfigured()) throw new AppError(503, "Google sign-in is not configured on the server.");
  res.redirect(startConnect(req.user.id));
});

app.get("/api/google/callback", requireUser, async (req, res) => {
  const back = (status) => res.redirect(`/?google=${status}`);
  if (req.query.error) return back("denied");
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!state || !code || !consumeState(state, req.user.id)) return back("error");
  try {
    await finishConnect(req.user.id, code);
    enableGoogleApps(req.user.id);
    back("connected");
  } catch (error) {
    console.warn("Google connect failed:", error.message);
    back("error");
  }
});

app.post("/api/google/disconnect", requireUser, async (req, res) => {
  await disconnectGoogle(req.user.id);
  res.json({ ok: true });
});

app.get("/api/calendar/events", requireUser, async (req, res) => {
  const events = await listUpcomingEvents(req.user.id, 7);
  res.json({ events });
});

app.post("/api/calendar/propose", requireUser, chatLimiter, async (req, res) => {
  const { text, timeZone } = parse(z.object({
    text: z.string().trim().min(1).max(1000),
    timeZone: z.string().min(1).max(64),
  }), req.body);
  if (!validTimeZone(timeZone)) throw new AppError(400, "Invalid time zone.");

  const raw = await chatCompletion([
    {
      role: "system",
      content: `Turn the user's request into one calendar event. Current local time: ${nowInZone(timeZone)} (${timeZone}).
Reply with JSON only, no prose: {"title": string or null, "start": "YYYY-MM-DDTHH:mm" in local time or null, "durationMinutes": number, "question": string or null}.
Do not invent details. If the title or time is unclear, set it to null and put one short follow-up question in "question".`,
    },
    { role: "user", content: text },
  ], { userId: req.user.id, maxTokens: 300, temperature: 0 });

  let parsed;
  try {
    parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new AppError(502, "The AI could not structure that. Try rephrasing it.");
  }

  const question = typeof parsed.question === "string" ? parsed.question : null;
  const title = typeof parsed.title === "string" ? parsed.title.trim().slice(0, 200) : "";
  const start = typeof parsed.start === "string" && LOCAL_TIME.test(parsed.start) ? parsed.start : "";
  if (!title || !start) {
    return res.json({ needsClarification: true, question: question || "What is the title, date and time?" });
  }
  const duration = Math.min(Math.max(Math.round(Number(parsed.durationMinutes) || 60), 5), 24 * 60);
  const startInstant = localToInstant(start, timeZone);
  if (Number.isNaN(startInstant.getTime()) || startInstant <= new Date()) {
    return res.json({ needsClarification: true, question: "That time is not in the future. Which time do you mean?" });
  }
  const endInstant = new Date(startInstant.getTime() + duration * 60_000);
  const localEnd = endInstant.toLocaleString("sv-SE", { timeZone }).replace(" ", "T").slice(0, 16);
  res.json({
    needsClarification: false,
    proposal: { title, start, end: localEnd, timeZone },
  });
});

app.post("/api/calendar/create", requireUser, async (req, res) => {
  const body = parse(z.object({
    confirmed: z.literal(true),
    title: z.string().trim().min(1).max(200),
    start: z.string().regex(LOCAL_TIME),
    end: z.string().regex(LOCAL_TIME),
    timeZone: z.string().min(1).max(64),
  }), req.body);
  if (!validTimeZone(body.timeZone)) throw new AppError(400, "Invalid time zone.");
  const startMs = localToInstant(body.start, body.timeZone).getTime();
  const endMs = localToInstant(body.end, body.timeZone).getTime();
  if (!(endMs > startMs) || endMs - startMs > 24 * 60 * 60 * 1000) {
    throw new AppError(400, "The event must end after it starts and last at most 24 hours.");
  }
  const event = await createEvent(req.user.id, body);
  res.json({ event });
});

// ---- memory, mail, usage and the admin page ----
app.use("/api", apiRouter);
app.use("/api", settingsApi);
app.use("/api", libraryApi);
app.use("/api", invitesApi);
app.use("/api", tasksApi);

// ---- static frontend (built by `npm run build`) ----

const distDir = path.join(config.root, "client", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distDir, "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.status(503).type("text").send("Frontend not built yet. Run: npm run build");
  });
}

// ---- errors ----

app.use((error, req, res, next) => {
  if (error instanceof AppError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON." });
  if (error.type === "entity.too.large") return res.status(413).json({ error: "That file is too large (max 6 MB)." });
  console.error("Unhandled error:", error.name, error.message);
  res.status(500).json({ error: "Something went wrong." });
});

app.listen(config.port, config.host, () => {
  startScheduler();
  console.log(`${config.assistantName} listening on http://${config.host}:${config.port} (public: ${config.publicUrl})`);
});
