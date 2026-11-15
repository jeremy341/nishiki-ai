import express from "express";
import { z } from "zod";
import { answerConversation } from "./answer.js";
import { requireUser } from "./auth.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";
import { notifyUser } from "./mail.js";

// Scheduled tasks: a prompt that runs by itself, once or every day or week, in its own chat.
// The assistant answers as if the user had asked; anything that changes data still waits for a tap
// in that chat. The result can also be sent to the phone through ntfy (if the user set a topic).

export const tasksApi = express.Router();
const DAY = 24 * 60 * 60 * 1000;

// Wall-clock parts of a moment in a time zone.
function wallParts(ms, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
  );
  return { y: Number(parts.year), mo: Number(parts.month), d: Number(parts.day), h: Number(parts.hour), mi: Number(parts.minute) };
}

// How far a time zone is ahead of UTC at a moment, in milliseconds.
function offsetMs(ms, tz) {
  const w = wallParts(ms, tz);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) - Math.floor(ms / 60000) * 60000;
}

// The UTC moment of a wall-clock time in a time zone (handles daylight saving time).
export function zonedToUtc(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - offsetMs(guess, tz);
  return guess - offsetMs(first, tz);
}

function addDays(y, mo, d, n) {
  const x = new Date(Date.UTC(y, mo - 1, d + n));
  return { y: x.getUTCFullYear(), mo: x.getUTCMonth() + 1, d: x.getUTCDate() };
}

// Monday is 0, Sunday is 6.
function weekdayOf(y, mo, d) {
  return (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7;
}

// The next moment a task should run after `after`, or null when it never will.
export function nextRun(task, after) {
  if (task.mode === "once") return task.run_at_ms > after ? task.run_at_ms : null;
  const [hh, mm] = task.time_of_day.split(":").map(Number);
  const today = wallParts(after, task.tz);
  for (let i = 0; i <= 8; i += 1) {
    const day = addDays(today.y, today.mo, today.d, i);
    if (task.mode === "weekly" && weekdayOf(day.y, day.mo, day.d) !== task.weekday) continue;
    const at = zonedToUtc(day.y, day.mo, day.d, hh, mm, task.tz);
    if (at > after) return at;
  }
  return null;
}

// Runs one task now: a new chat, the prompt as the question, the answer, and a phone notice.
export async function runTask(task) {
  const now = Date.now();
  const { lastInsertRowid } = db.prepare("INSERT INTO conversations (user_id, title) VALUES (?, ?)")
    .run(task.user_id, task.title.slice(0, 120));
  const conversationId = Number(lastInsertRowid);
  const question = db.prepare("INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, 'user', ?)")
    .run(task.user_id, conversationId, task.prompt);
  db.prepare("UPDATE scheduled_tasks SET last_run_ms = ?, last_conversation_id = ?, last_error = NULL WHERE id = ?")
    .run(now, conversationId, task.id);
  try {
    await answerConversation({ userId: task.user_id, conversationId, userMessageId: Number(question.lastInsertRowid) });
    await notifyUser(task.user_id, "Nishiki", `Aufgabe fertig: ${task.title}`).catch(() => {});
  } catch (error) {
    const message = error instanceof AppError ? error.message : "The task could not finish.";
    db.prepare("UPDATE scheduled_tasks SET last_error = ? WHERE id = ?").run(message.slice(0, 200), task.id);
  }
  return conversationId;
}

let running = false;

// Called by the scheduler every minute: runs the tasks that are due.
export async function runDueTasks() {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    const due = db.prepare(`
      SELECT * FROM scheduled_tasks
      WHERE enabled = 1 AND next_run_ms IS NOT NULL AND next_run_ms <= ?
      ORDER BY next_run_ms LIMIT 5
    `).all(now);
    for (const task of due) {
      // Advance only after runTask returns, so a crash before the task starts cannot
      // silently clear it. A crash after execution but before this update can repeat
      // the chat and notification; data-changing actions still require user confirmation.
      await runTask(task);
      const next = task.mode === "once" ? null : nextRun(task, now + 1000);
      db.prepare("UPDATE scheduled_tasks SET next_run_ms = ?, enabled = ? WHERE id = ?")
        .run(next, task.mode === "once" ? 0 : 1, task.id);
    }
  } finally {
    running = false;
  }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseInput(data) {
  const result = taskInput.safeParse(data);
  if (!result.success) throw new AppError(400, "Check the task: title, prompt, time and day.");
  return result.data;
}

const taskInput = z.object({
  title: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(2000),
  mode: z.enum(["once", "daily", "weekly"]),
  timeOfDay: z.string().regex(TIME).optional(),
  weekday: z.number().int().min(0).max(6).optional(),
  runAt: z.number().int().positive().optional(),
  tz: z.string().min(3).max(60),
  enabled: z.boolean().optional(),
});

function checkTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    throw new AppError(400, "That time zone is not known.");
  }
}

// Turns the form into the stored fields, and works out the next run.
function fieldsFrom(input, now) {
  checkTimeZone(input.tz);
  if (input.mode === "once") {
    if (!input.runAt || input.runAt <= now) throw new AppError(400, "Pick a time in the future.");
    return { mode: "once", time_of_day: null, weekday: null, run_at_ms: input.runAt, tz: input.tz };
  }
  if (!input.timeOfDay) throw new AppError(400, "Pick a time of day.");
  if (input.mode === "weekly" && input.weekday === undefined) throw new AppError(400, "Pick a weekday.");
  return {
    mode: input.mode,
    time_of_day: input.timeOfDay,
    weekday: input.mode === "weekly" ? input.weekday : null,
    run_at_ms: null,
    tz: input.tz,
  };
}

function rowFor(row) {
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    mode: row.mode,
    timeOfDay: row.time_of_day,
    weekday: row.weekday,
    runAt: row.run_at_ms,
    tz: row.tz,
    enabled: Boolean(row.enabled),
    nextRun: row.next_run_ms,
    lastRun: row.last_run_ms,
    lastConversationId: row.last_conversation_id,
    lastError: row.last_error,
  };
}

tasksApi.get("/tasks", requireUser, (req, res) => {
  const rows = db.prepare("SELECT * FROM scheduled_tasks WHERE user_id = ? ORDER BY id DESC").all(req.user.id);
  res.json({ tasks: rows.map(rowFor) });
});

// Checks a task without storing it: returns the stored fields and the first run time.
export function describeTask(data) {
  const input = parseInput(data);
  const now = Date.now();
  const fields = fieldsFrom(input, now);
  const next = fields.mode === "once" ? fields.run_at_ms : nextRun(fields, now);
  if (!next) throw new AppError(400, "This schedule never runs. Check the day and time.");
  return { input, fields, next };
}

// Checks the input and stores a new task. Used by the form and by a confirmed "schedule" card in a chat.
export function createTask(userId, data) {
  const { input, fields, next } = describeTask(data);
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO scheduled_tasks (user_id, title, prompt, mode, time_of_day, weekday, run_at_ms, tz, enabled, next_run_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(userId, input.title, input.prompt, fields.mode, fields.time_of_day, fields.weekday,
    fields.run_at_ms, fields.tz, next);
  return rowFor(db.prepare("SELECT * FROM scheduled_tasks WHERE id = ?").get(Number(lastInsertRowid)));
}

tasksApi.post("/tasks", requireUser, (req, res) => {
  res.status(201).json({ task: createTask(req.user.id, req.body) });
});

tasksApi.put("/tasks/:id", requireUser, (req, res) => {
  const id = Number(req.params.id);
  const current = db.prepare("SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?").get(id, req.user.id);
  if (!current) throw new AppError(404, "That task does not exist.");
  const input = parseInput(req.body);
  const now = Date.now();
  const fields = fieldsFrom(input, now);
  const next = fields.mode === "once" ? fields.run_at_ms : nextRun(fields, now);
  const enabled = input.enabled ?? true;
  if (enabled && !next) throw new AppError(400, "This schedule never runs. Check the day and time.");
  db.prepare(`
    UPDATE scheduled_tasks SET title = ?, prompt = ?, mode = ?, time_of_day = ?, weekday = ?, run_at_ms = ?, tz = ?,
      enabled = ?, next_run_ms = ? WHERE id = ?
  `).run(input.title, input.prompt, fields.mode, fields.time_of_day, fields.weekday, fields.run_at_ms, fields.tz,
    enabled ? 1 : 0, enabled ? next : null, id);
  res.json({ task: rowFor(db.prepare("SELECT * FROM scheduled_tasks WHERE id = ?").get(id)) });
});

tasksApi.delete("/tasks/:id", requireUser, (req, res) => {
  const { changes } = db.prepare("DELETE FROM scheduled_tasks WHERE id = ? AND user_id = ?").run(Number(req.params.id), req.user.id);
  if (!changes) throw new AppError(404, "That task does not exist.");
  res.json({ ok: true });
});

// Run now, as well as on schedule.
tasksApi.post("/tasks/:id/run", requireUser, async (req, res) => {
  const task = db.prepare("SELECT * FROM scheduled_tasks WHERE id = ? AND user_id = ?").get(Number(req.params.id), req.user.id);
  if (!task) throw new AppError(404, "That task does not exist.");
  const conversationId = await runTask(task);
  res.json({ conversationId, task: rowFor(db.prepare("SELECT * FROM scheduled_tasks WHERE id = ?").get(task.id)) });
});
