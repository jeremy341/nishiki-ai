import { db } from "./db.js";
import { AppError } from "./errors.js";

// Long-term memory: facts the user explicitly asked to keep ("remember that…").
// Nothing is saved automatically. Every fact can be seen and deleted by the user.
const MAX_MEMORIES = 200;
const PROMPT_LIMIT = 60;
const PROMPT_CHARS = 4000;

export function listMemories(userId) {
  return db.prepare("SELECT id, text, source, created_at FROM memories WHERE user_id = ? ORDER BY id DESC").all(userId);
}

export function addMemory(userId, text, source = "user") {
  const count = db.prepare("SELECT COUNT(*) AS n FROM memories WHERE user_id = ?").get(userId).n;
  if (count >= MAX_MEMORIES) throw new AppError(400, "Memory is full. Delete something first.");
  const clean = String(text || "").trim().slice(0, 500);
  if (!clean) throw new AppError(400, "Nothing to remember.");
  const { lastInsertRowid } = db.prepare("INSERT INTO memories (user_id, text, source) VALUES (?, ?, ?)")
    .run(userId, clean, source === "chat" ? "chat" : "user");
  return { id: Number(lastInsertRowid), text: clean };
}

export function deleteMemory(userId, id) {
  const result = db.prepare("DELETE FROM memories WHERE id = ? AND user_id = ?").run(Number(id), userId);
  if (!result.changes) throw new AppError(404, "That memory does not exist.");
}

// The part of the system prompt that carries the user's memory.
export function memoryBlock(userId) {
  const rows = db.prepare("SELECT text FROM memories WHERE user_id = ? ORDER BY id DESC LIMIT ?")
    .all(userId, PROMPT_LIMIT);
  if (!rows.length) return "";
  let body = "";
  for (const row of rows.reverse()) {
    if (body.length + row.text.length > PROMPT_CHARS) break;
    body += `- ${row.text}\n`;
  }
  return `Things the user asked you to remember (use them when relevant, never invent more):\n${body}`;
}
