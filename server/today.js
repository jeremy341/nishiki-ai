import { appOn } from "./apps.js";
import { config } from "./config.js";
import { db } from "./db.js";
import { googleStatus, listUpcomingEvents } from "./google.js";

// What is coming up, for the quiet line on the home screen: the next appointment in the next 24 hours (when Google Calendar
// is connected) and how many reminders and tasks are due in that time.
export async function todayFor(userId) {
  let event = null;
  if (googleStatus(userId).connected && appOn(userId, "calendar")) {
    try {
      const events = await listUpcomingEvents(userId, 1);
      const now = Date.now();
      const next = events.find((e) => e.start && !e.allDay && Date.parse(e.start) >= now - 15 * 60 * 1000) || events.find((e) => e.allDay);
      if (next) event = { title: String(next.title).slice(0, 60), start: next.start, allDay: next.allDay };
    } catch {
      /* the calendar could not be read right now: the line simply has no appointment */
    }
  }
  const reminders = db.prepare(
    "SELECT COUNT(*) AS n FROM scheduled_tasks WHERE user_id = ? AND enabled = 1 AND next_run_ms IS NOT NULL AND next_run_ms <= ?",
  ).get(userId, Date.now() + 24 * 60 * 60 * 1000).n;
  return { event, reminders, timezone: config.timezone };
}
