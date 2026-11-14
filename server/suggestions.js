import { callModel } from "./ai.js";
import { appOn } from "./apps.js";
import { db } from "./db.js";
import { googleStatus, listUpcomingEvents } from "./google.js";
import { listMemories } from "./memory.js";
import { getFeatures, getPrefs } from "./prefs.js";

// The suggestions on the empty chat screen. They come from what the assistant already
// knows (next calendar events, saved memories, recent chat titles). One small model call,
// cached for 30 minutes per user, so opening the app again costs nothing.

export const STARTERS = [
  "Plan my week around a dentist visit on Tuesday",
  "Make a chart of my workouts this week",
  "Write a short packing list for a weekend trip",
  "Remember that I like green tea",
];

const TTL_MS = 30 * 60 * 1000;
const SOURCES = ["calendar", "memory", "chat", "general"];
const cache = new Map();

async function contextLines(userId) {
  const lines = [];
  const features = getFeatures(userId);
  const prefs = getPrefs(userId);

  if (features.calendar && appOn(userId, "calendar") && googleStatus(userId).connected) {
    try {
      const events = await listUpcomingEvents(userId, 2);
      for (const event of events.slice(0, 5)) {
        lines.push(`Calendar: ${event.title}${event.start ? ` (${event.start})` : ""}`);
      }
    } catch {
      /* calendar not reachable right now: suggestions use the rest */
    }
  }
  if (features.memory && prefs.memory) {
    for (const memory of listMemories(userId).slice(0, 8)) lines.push(`Memory: ${memory.text}`);
  }
  const chats = db.prepare(`
    SELECT title FROM conversations WHERE user_id = ? AND title IS NOT NULL
    ORDER BY updated_at DESC LIMIT 5
  `).all(userId);
  for (const chat of chats) lines.push(`Recent chat: ${chat.title}`);
  return lines;
}

function parseItems(text) {
  const match = /\[[\s\S]*\]/.exec(text || "");
  if (!match) return null;
  let list;
  try {
    list = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const items = (Array.isArray(list) ? list : [])
    .map((item) => ({
      text: String(item?.text || "").trim().slice(0, 80),
      source: SOURCES.includes(item?.source) ? item.source : "general",
    }))
    .filter((item) => item.text)
    .slice(0, 4);
  return items.length ? items : null;
}

async function build(userId) {
  const lines = await contextLines(userId);
  if (!lines.length) return STARTERS.map((text) => ({ text, source: "general", fallback: true }));
  try {
    const reply = await callModel([
      {
        role: "system",
        content: "Suggest what the user might ask their personal assistant next, from the context. "
          + "Reply with only a JSON array of 4 objects: {\"text\": a request in the user's words, under 60 characters, "
          + "\"source\": \"calendar\", \"memory\", \"chat\" or \"general\"}. Write the texts in " + (getPrefs(userId).uiLanguage === "en" ? "English" : "German") + ". Invent nothing.",
      },
      { role: "user", content: lines.join("\n").slice(0, 3000) },
    ], { role: "chat", userId, maxTokens: 260, temperature: 0.5 });
    const items = parseItems(reply.content);
    if (items) return items;
  } catch (error) {
    console.warn("Suggestions fell back:", error.name);
  }
  return STARTERS.map((text) => ({ text, source: "general", fallback: true }));
}

export async function suggestionsFor(userId) {
  const hit = cache.get(userId);
  if (hit && hit.until > Date.now()) return hit.items;
  const items = await build(userId);
  cache.set(userId, { items, until: Date.now() + TTL_MS });
  return items;
}
