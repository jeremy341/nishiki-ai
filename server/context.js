import { chatCompletion } from "./ai.js";
import { attachmentsByMessage, modelContent, recentWithData } from "./attachments.js";
import { config } from "./config.js";
import { db } from "./db.js";

// Long chats: the whole conversation is sent to the model, up to a size budget.
// When a chat grows past the budget, the oldest messages are folded into a rolling summary
// (written by the same model) and the newest messages are kept word for word.
const KEEP_VERBATIM = 30;
const IMAGE_CHARS = 1500; // rough cost of a photo in the budget
const PDF_CHARS = 12000; // rough cost of a PDF

function sizeOf(message, files = []) {
  let size = (message.content || "").length;
  for (const f of files) size += f.kind === "image" ? IMAGE_CHARS : PDF_CHARS;
  return size;
}

function transcript(messages, files) {
  return messages.map((m) => {
    const names = (files.get(m.id) || []).map((f) => ` [attached: ${f.name}]`).join("");
    return `${m.role === "user" ? "User" : "Assistant"}: ${m.content}${names}`;
  }).join("\n\n");
}

const SUMMARY_SYSTEM = `You keep the memory of a long chat between a user and their assistant.
Update the summary with the new messages. Keep names, facts about the user, decisions, preferences, open tasks and anything the user may refer back to. Drop small talk. Write plain text, under 900 words, in the language the chat is in.`;

async function summarize(previous, older, files, userId) {
  const body = [
    previous ? `Summary so far:\n${previous}` : "There is no summary yet.",
    `New messages to fold in:\n${transcript(older, files)}`,
  ].join("\n\n");
  return chatCompletion([
    { role: "system", content: SUMMARY_SYSTEM },
    { role: "user", content: body },
  ], { userId, maxTokens: 1500, temperature: 0.2 });
}

// Returns the model input for a chat: system messages, the summary (if any), then the chat.
export async function buildModelInput(conversationId, userId, systemMessages) {
  const conv = db.prepare("SELECT summary, summary_upto FROM conversations WHERE id = ?").get(conversationId);
  const files = attachmentsByMessage(conversationId);
  let summary = conv?.summary || "";
  let rows = db.prepare(
    "SELECT id, role, content FROM messages WHERE conversation_id = ? AND id > ? ORDER BY id",
  ).all(conversationId, conv?.summary_upto || 0);

  const total = () => rows.reduce((sum, m) => sum + sizeOf(m, files.get(m.id)), 0);
  if (total() > config.ai.historyChars && rows.length > 2) {
    // Everything that leaves the window is folded into the summary, never silently dropped.
    // The window is cut down to a comfortable size, and the newest messages stay word for word.
    const older = [];
    while (rows.length > 2 && (total() > config.ai.historyChars * 0.7 || rows.length > KEEP_VERBATIM)) {
      older.push(rows.shift());
    }
    try {
      summary = await summarize(summary, older, files, userId);
      db.prepare("UPDATE conversations SET summary = ?, summary_upto = ? WHERE id = ?")
        .run(summary, older[older.length - 1].id, conversationId);
    } catch (error) {
      // Summary failed: the folded messages are left out of this reply and retried next time.
      console.warn("Chat summary failed:", error.name);
      rows = [...older, ...rows];
      while (rows.length > 2 && total() > config.ai.historyChars) rows.shift();
    }
  }

  const withData = recentWithData(rows, files);
  const messages = [...systemMessages];
  if (summary) {
    messages.push({
      role: "system",
      content: `Summary of the earlier part of this conversation (your own memory of it):\n${summary}`,
    });
  }
  for (const m of rows) {
    messages.push({
      role: m.role,
      content: modelContent(m, files.get(m.id), withData.has(m.id), userId),
    });
  }
  return messages;
}
