import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { makePdf } from "./pdf.js";
import { slidesText } from "./slides.js";
import { config } from "./config.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";

export const MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 4;
// Only the newest uploads keep their full data in the model context; older ones are named in text.
const RECENT_WITH_DATA = 4;
// How much of a document the model reads, in characters.
const TEXT_LIMIT = 60000;

// Plain text: no binary bytes, and valid UTF-8.
const isText = (b) => !b.subarray(0, 4096).includes(0) && !Buffer.from(b).toString("utf8").includes("�");
// Word files are zip archives.
const isZip = (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

const TYPES = {
  "image/jpeg": { kind: "image", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { kind: "image", magic: (b) => b.subarray(0, 4).toString("hex") === "89504e47" },
  "image/gif": { kind: "image", magic: (b) => b.subarray(0, 4).toString("ascii") === "GIF8" },
  "image/webp": { kind: "image", magic: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
  "application/pdf": { kind: "pdf", magic: (b) => b.subarray(0, 4).toString("ascii") === "%PDF" },
  "text/csv": { kind: "csv", magic: isText },
  "text/plain": { kind: "text", magic: isText },
  "text/markdown": { kind: "text", magic: isText },
  "application/json": { kind: "text", magic: isText },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { kind: "docx", magic: isZip },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { kind: "pptx", magic: isZip },
};

const FILES_DIR = path.join(config.dataDir, "files");
const LIMIT_BYTES = config.storageLimitMb * 1024 * 1024;

// One shared room for everyone's files on this server.
export function usedBytes() {
  return Number(db.prepare("SELECT COALESCE(SUM(size), 0) AS n FROM attachments").get().n);
}

export function removeFile(file) {
  try {
    fs.rmSync(file, { force: true });
  } catch {
    /* already gone */
  }
}

// Word files are read to plain text once, at upload. The text goes to the model and to the viewer.
async function extractText(type, data) {
  if (type.kind === "docx") {
    try {
      const { value } = await mammoth.extractRawText({ buffer: data });
      return value.slice(0, TEXT_LIMIT);
    } catch {
      throw new AppError(400, "That Word file could not be read.");
    }
  }
  if (type.kind === "pptx") return slidesText(data);
  if (type.kind === "csv" || type.kind === "text") return data.toString("utf8").slice(0, TEXT_LIMIT);
  return null;
}

// Files are written to the server's disk, one folder per user. The database keeps the record and the text.
export async function storeUpload({ userId, name, mime, base64 }) {
  const type = TYPES[mime];
  if (!type) throw new AppError(400, "Supported: photos, PDF, CSV, Word (.docx), text, Markdown and JSON files.");
  const data = Buffer.from(base64, "base64");
  if (!data.length) throw new AppError(400, "The file is empty.");
  if (data.length > MAX_ATTACHMENT_BYTES) throw new AppError(400, "That file is too large (max 6 MB).");
  if (!type.magic(data)) throw new AppError(400, "The file content does not match its type.");
  if (usedBytes() + data.length > LIMIT_BYTES) {
    throw new AppError(413, "The file storage on the server is full. Delete files in the Library to make room.");
  }

  const cleanName = name.replace(/[\u0000-\u001f]/g, "").slice(0, 200) || "file";
  const text = await extractText(type, data);
  const dir = path.join(FILES_DIR, String(userId));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, randomBytes(16).toString("hex"));
  if (usedBytes() + data.length > LIMIT_BYTES) {
    throw new AppError(413, "The file storage on the server is full. Delete files in the Library to make room.");
  }
  let lastInsertRowid;
  try {
    fs.writeFileSync(file, data, { mode: 0o600 });
    ({ lastInsertRowid } = db.prepare(
      "INSERT INTO attachments (user_id, kind, mime, name, size, data, path, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(userId, type.kind, mime, cleanName, data.length, Buffer.alloc(0), file, text));
  } catch (error) {
    removeFile(file);
    throw error;
  }
  return { id: Number(lastInsertRowid), kind: type.kind, mime, name: cleanName, size: data.length };
}

// Checks that every id is an unsent upload of this user, then attaches them to the message.
export function linkToMessage({ userId, ids, messageId, conversationId }) {
  if (!ids.length) return;
  if (ids.length > MAX_ATTACHMENTS_PER_MESSAGE) throw new AppError(400, "Attach at most 4 files per message.");
  const placeholders = ids.map(() => "?").join(",");
  const found = db.prepare(
    `SELECT id FROM attachments WHERE user_id = ? AND message_id IS NULL AND id IN (${placeholders})`,
  ).all(userId, ...ids);
  if (found.length !== ids.length) throw new AppError(400, "One of the attachments could not be found. Upload it again.");
  const update = db.prepare("UPDATE attachments SET message_id = ?, conversation_id = ? WHERE id = ?");
  for (const id of ids) update.run(messageId, conversationId, id);
}

export function unlinkMessage(messageId) {
  db.prepare("UPDATE attachments SET message_id = NULL, conversation_id = NULL WHERE message_id = ?").run(messageId);
}

// Metadata for the chat view, grouped by message id.
export function attachmentsByMessage(conversationId) {
  const rows = db.prepare(`
    SELECT id, message_id, kind, mime, name, size FROM attachments
    WHERE conversation_id = ? AND message_id IS NOT NULL ORDER BY id
  `).all(conversationId);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.message_id)) map.set(row.message_id, []);
    map.get(row.message_id).push({ id: row.id, kind: row.kind, mime: row.mime, name: row.name, size: row.size });
  }
  return map;
}

// The text of a Word, CSV or text file, for the viewer.
export function textFor(userId, id) {
  return db.prepare("SELECT name, kind, text FROM attachments WHERE id = ? AND user_id = ?").get(id, userId);
}

// The file itself, from disk or (for older uploads) from the database.
export function attachmentFor(userId, id) {
  const row = db.prepare("SELECT mime, name, data, path FROM attachments WHERE id = ? AND user_id = ?").get(id, userId);
  if (!row) return undefined;
  if (row.path) {
    try {
      return { mime: row.mime, name: row.name, data: fs.readFileSync(row.path) };
    } catch {
      return undefined;
    }
  }
  return { mime: row.mime, name: row.name, data: row.data };
}

// Removes one file of this user: the disk copy and the record.
export function deleteAttachment(userId, id) {
  const row = db.prepare("SELECT path FROM attachments WHERE id = ? AND user_id = ?").get(id, userId);
  if (!row) return false;
  if (row.path) removeFile(row.path);
  db.prepare("DELETE FROM attachments WHERE id = ? AND user_id = ?").run(id, userId);
  return true;
}

// Removes the disk copies of every file matching the condition, before the rows go away.
export function removeFilesWhere(sql, params) {
  for (const row of db.prepare(`SELECT path FROM attachments WHERE ${sql}`).all(...params)) {
    if (row.path) removeFile(row.path);
  }
}

// The Library: every file the user has sent or received, newest first.
export function listLibrary(userId) {
  return db.prepare(`
    SELECT a.id, a.kind, a.mime, a.name, a.size, a.created_at, a.conversation_id, c.title AS chat
    FROM attachments a LEFT JOIN conversations c ON c.id = a.conversation_id
    WHERE a.user_id = ? AND a.message_id IS NOT NULL
    ORDER BY a.id DESC LIMIT 500
  `).all(userId).map((r) => ({
    id: r.id,
    kind: r.kind,
    mime: r.mime,
    name: r.name,
    size: r.size,
    createdAt: r.created_at,
    conversationId: r.conversation_id,
    chat: r.chat || null,
  }));
}

export function storageInfo() {
  return { usedBytes: usedBytes(), limitBytes: LIMIT_BYTES };
}

// Builds the model input for a message. Photos and PDFs go as files; Word, CSV and text files
// go as their text. Older uploads are only named.
export function modelContent(message, attachments, withData, userId) {
  if (!attachments?.length) return message.content;
  const parts = [];
  if (message.content) parts.push({ type: "text", text: message.content });
  for (const meta of attachments) {
    if (meta.kind === "docx" || meta.kind === "pptx" || meta.kind === "csv" || meta.kind === "text") {
      const row = withData ? textFor(userId, meta.id) : null;
      parts.push({
        type: "text",
        text: row ? `Attached file "${meta.name}":\n${row.text || "(no readable text)"}` : `[Earlier attachment: ${meta.name}]`,
      });
      continue;
    }
    const row = withData ? attachmentFor(userId, meta.id) : null;
    if (!row) {
      parts.push({ type: "text", text: `[Earlier attachment: ${meta.name}]` });
    } else if (meta.kind === "image") {
      parts.push({ type: "image_url", image_url: { url: `data:${row.mime};base64,${row.data.toString("base64")}` } });
    } else {
      parts.push({ type: "file", file: { filename: row.name, file_data: `data:${row.mime};base64,${row.data.toString("base64")}` } });
    }
  }
  return parts;
}

// Which messages (by id) are recent enough to include their binary data.
export function recentWithData(messages, attachmentMap) {
  const ids = new Set();
  let bytes = 0;
  for (const m of [...messages].reverse()) {
    if (m.role !== "user" || !attachmentMap.has(m.id)) continue;
    const size = attachmentMap.get(m.id).reduce((n, a) => n + (a.size || 0), 0);
    if (ids.size >= RECENT_WITH_DATA || bytes + size > config.ai.attachmentBytesPerRequest) continue;
    ids.add(m.id);
    bytes += size;
  }
  return ids;
}

// A Word file as a PDF. The text is the one read at upload; the PDF is kept like any other file,
// and is attached to the same message as the Word file.
export async function wordAsPdf(userId, id) {
  const row = db.prepare("SELECT name, kind, text, message_id, conversation_id FROM attachments WHERE id = ? AND user_id = ?")
    .get(id, userId);
  if (!row || row.kind !== "docx") throw new AppError(404, "No Word file with that id.");
  const title = row.name.replace(/.docx$/i, "") || "document";
  const bytes = await makePdf(title, row.text || "");
  const stored = await storeUpload({ userId, name: `${title.slice(0, 150)}.pdf`, mime: "application/pdf", base64: bytes.toString("base64") });
  if (row.message_id) linkToMessage({ userId, ids: [stored.id], messageId: row.message_id, conversationId: row.conversation_id });
  return stored;
}
