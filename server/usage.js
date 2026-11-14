import { db } from "./db.js";

// What the usage page and the admin see: messages and AI tokens over the last 24 hours.
// There are no caps: this is a small, invite-only group.
export function usageLast24h(userId) {
  const messages = db.prepare(`
    SELECT COUNT(*) AS n FROM messages
    WHERE user_id = ? AND role = 'user' AND created_at >= datetime('now', '-1 day')
  `).get(userId).n;
  const tokens = db.prepare(`
    SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS n FROM usage
    WHERE user_id = ? AND created_at >= datetime('now', '-1 day')
  `).get(userId).n;
  return { messages, tokens };
}
