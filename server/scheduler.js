import { db } from "./db.js";
import { runMailReport } from "./mail.js";
import { runDueTasks } from "./scheduled.js";

// Background work. Runs in this same process, every 10 minutes:
// the mail report for each user who switched it on and gave consent.
const EVERY_MS = 10 * 60 * 1000;

async function runDueJobs() {
  const users = db.prepare("SELECT user_id FROM mail_settings WHERE report_enabled = 1 AND consent = 1").all();
  for (const { user_id: userId } of users) {
    try {
      const result = await runMailReport(userId);
      // Counts only: never subjects, senders or message content.
      if (result.important) console.log(`Mail report for user ${userId}: ${result.important} important of ${result.checked}`);
    } catch (error) {
      console.warn(`Mail report for user ${userId} failed:`, error.name);
    }
  }
}

// Scheduled tasks are checked every minute.
const TASK_EVERY_MS = 60 * 1000;

export function startScheduler() {
  if (process.env.SCHEDULER === "0") return;
  setInterval(() => { runDueJobs(); }, EVERY_MS).unref();
  setInterval(() => { runDueTasks().catch((error) => console.warn("Tasks failed:", error.name)); }, TASK_EVERY_MS).unref();
}

export { runDueJobs };
