import { callModel } from "./ai.js";
import { db } from "./db.js";
import { addMemory, listMemories } from "./memory.js";
import { getFeatures, getPrefs } from "./prefs.js";

// Learns from chats: after a reply, the assistant looks at the latest exchange and saves up
// to three facts that will matter in later chats (a preference, a person, a routine).
// It runs in the background, at most once every 10 minutes per user, so chats stay fast and
// cheap. Every learned fact shows in Settings → Memory and can be deleted.

const GAP_MS = 10 * 60 * 1000;
const lastRun = new Map();

export function learnFromChat(userId, conversationId) {
  const prefs = getPrefs(userId);
  const features = getFeatures(userId);
  if (!prefs.learnFromChats || !prefs.memory || !features.memory) return;
  const now = Date.now();
  if (now - (lastRun.get(userId) || 0) < GAP_MS) return;
  lastRun.set(userId, now);
  setImmediate(() => {
    learn(userId, conversationId).catch((error) => console.warn("Learning from chat skipped:", error.name));
  });
}

function parseFacts(text) {
  const match = /\[[\s\S]*\]/.exec(text || "");
  if (!match) return [];
  try {
    const list = JSON.parse(match[0]);
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function learn(userId, conversationId) {
  const rows = db.prepare("SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 8")
    .all(conversationId).reverse();
  if (rows.length < 2) return;
  const known = listMemories(userId).slice(0, 40).map((m) => m.text);
  const transcript = rows
    .map((r) => `${r.role === "user" ? "User" : "Assistant"}: ${String(r.content || "").slice(0, 400)}`)
    .join("\n");
  const reply = await callModel([
    {
      role: "system",
      content: "From this chat, pick up to 3 facts about the user that will still matter in future chats: "
        + "preferences, people they mention, routines, goals, dates. Skip anything temporary, anything about health, "
        + "money or passwords, and anything already known. Reply with only a JSON array of short strings "
        + "in the user's language, or [].",
    },
    { role: "user", content: `Already known:\n${known.join("\n") || "-"}\n\nChat:\n${transcript}` },
  ], { role: "chat", userId, maxTokens: 200, temperature: 0.2 });

  const seen = new Set(known.map((t) => t.toLowerCase()));
  for (const fact of parseFacts(reply.content).slice(0, 3)) {
    const clean = fact.trim().slice(0, 500);
    if (!clean || seen.has(clean.toLowerCase())) continue;
    try {
      addMemory(userId, clean, "chat");
      seen.add(clean.toLowerCase());
    } catch {
      return; // memory is full: stop quietly
    }
  }
}
