import { CalendarClock, MessageSquare, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "./api.js";
import { currentLocale, t } from "./i18n/index.js";
import { Button, Card, Field, FullPage, IconButton, Input, Modal, Select, Sheet, Switch } from "./ui/ui.jsx";

// Scheduled tasks: a question that the assistant answers by itself, once, every day or every week.
// Each run opens its own chat, and the answer appears there (and as a phone notice, if set up).

const MODES = [
  { value: "once", label: "Once" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
];

// 2 November 2026 is a Monday, so index 0 is Monday.
function weekdayName(index) {
  return new Date(Date.UTC(2026, 10, 2 + index)).toLocaleDateString(currentLocale(), { weekday: "long", timeZone: "UTC" });
}

function whenText(ms) {
  if (!ms) return "";
  return new Date(ms).toLocaleString(currentLocale(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function scheduleText(task) {
  if (task.mode === "once") return t("Once, on {date}", { date: whenText(task.runAt) });
  if (task.mode === "daily") return t("Every day at {time}", { time: task.timeOfDay });
  return t("Every {day} at {time}", { day: weekdayName(task.weekday), time: task.timeOfDay });
}

// A datetime-local value for the browser, one hour from now.
function localInput(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY = { title: "", prompt: "", mode: "daily", time: "08:00", weekday: 0, when: localInput(Date.now() + 3600000) };

function TaskForm({ task, onClose, onSaved }) {
  const [form, setForm] = useState(() => (task ? {
    title: task.title,
    prompt: task.prompt,
    mode: task.mode,
    time: task.timeOfDay || "08:00",
    weekday: task.weekday ?? 0,
    when: task.runAt ? localInput(task.runAt) : EMPTY.when,
  } : EMPTY));
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    const body = {
      title: form.title.trim(),
      prompt: form.prompt.trim(),
      mode: form.mode,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      enabled: task ? task.enabled : true,
    };
    if (form.mode === "once") body.runAt = new Date(form.when).getTime();
    else body.timeOfDay = form.time;
    if (form.mode === "weekly") body.weekday = Number(form.weekday);
    try {
      if (task) await api(`/api/tasks/${task.id}`, { method: "PUT", body });
      else await api("/api/tasks", { method: "POST", body });
      toast.success(t("Task saved"));
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={save}>
      <Field label={t("Title")}>
        <Input value={form.title} maxLength={80} required onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </Field>
      <Field label={t("What should the assistant do?")} hint={t("Written as if you asked it yourself.")}>
        <textarea
          className="min-h-24 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-base md:text-sm focus:border-fg-subtle focus:outline-none focus:ring-2 focus:ring-fg/10"
          value={form.prompt}
          maxLength={2000}
          required
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("How often")}>
          <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
            {MODES.map((m) => <option key={m.value} value={m.value}>{t(m.label)}</option>)}
          </Select>
        </Field>
        {form.mode === "once" && (
          <Field label={t("When")}>
            <Input type="datetime-local" value={form.when} required onChange={(e) => setForm({ ...form, when: e.target.value })} />
          </Field>
        )}
        {form.mode !== "once" && (
          <Field label={t("Time")}>
            <Input type="time" value={form.time} required onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </Field>
        )}
        {form.mode === "weekly" && (
          <Field label={t("Day")}>
            <Select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => <option key={i} value={i}>{weekdayName(i)}</option>)}
            </Select>
          </Field>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={onClose} disabled={busy}>{t("Cancel")}</Button>
        <Button variant="primary" type="submit" disabled={busy || !form.title.trim() || !form.prompt.trim()}>{t("Save")}</Button>
      </div>
    </form>
  );
}

export default function Tasks({ onClose, onOpenChat }) {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null, {} for a new task, or a task
  const [deleting, setDeleting] = useState(null);

  function load() {
    api("/api/tasks")
      .then((data) => setTasks(data.tasks))
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function toggle(task, enabled) {
    try {
      await api(`/api/tasks/${task.id}`, {
        method: "PUT",
        body: {
          title: task.title, prompt: task.prompt, mode: task.mode, timeOfDay: task.timeOfDay ?? undefined,
          weekday: task.weekday ?? undefined, runAt: task.runAt ?? undefined, tz: task.tz, enabled,
        },
      });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function runNow(task) {
    try {
      const result = await api(`/api/tasks/${task.id}/run`, { method: "POST", body: {} });
      toast.success(t("Task finished"));
      load();
      if (result.conversationId) onOpenChat(result.conversationId);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function confirmDelete() {
    try {
      await api(`/api/tasks/${deleting.id}`, { method: "DELETE", body: {} });
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <FullPage title={t("Scheduled tasks")} onClose={onClose}>
      <div className="grid gap-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-fg-muted">{t("The assistant answers these by itself, in their own chat.")}</p>
          <Button variant="primary" className="shrink-0 whitespace-nowrap" onClick={() => setEditing({})}><Plus size={16} aria-hidden="true" /> {t("New task")}</Button>
        </div>

        {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">{error}</p>}

        {tasks === null && !error && (
          <div className="grid gap-3" aria-busy="true">
            {[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-surface" />)}
          </div>
        )}

        {tasks && !tasks.length && (
          <Card className="grid justify-items-center gap-3 px-6 py-10 text-center">
            <CalendarClock size={28} aria-hidden="true" className="text-fg-muted" />
            <p className="font-medium">{t("No scheduled tasks yet")}</p>
            <p className="max-w-[40ch] text-sm text-fg-muted">{t("For example: every weekday at 8:00, a short summary of my calendar and mail.")}</p>
          </Card>
        )}

        {tasks?.map((task) => (
          <Card key={task.id} className="grid gap-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{task.title}</div>
                <div className="mt-0.5 text-sm text-fg-muted">{scheduleText(task)}</div>
              </div>
              <Switch checked={task.enabled} onCheckedChange={(v) => toggle(task, v)} label={t("On")} />
            </div>
            <p className="line-clamp-2 text-sm text-fg-muted">{task.prompt}</p>
            <div className="grid gap-1 text-[13px] text-fg-subtle">
              {task.enabled && task.nextRun && <span>{t("Next: {when}", { when: whenText(task.nextRun) })}</span>}
              {task.lastRun && <span>{t("Last ran {when}", { when: whenText(task.lastRun) })}</span>}
              {task.lastError && <span className="text-danger">{task.lastError}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-1 pt-1">
              <Button size="sm" onClick={() => runNow(task)}><Play size={14} aria-hidden="true" /> {t("Run now")}</Button>
              {task.lastConversationId && (
                <IconButton label={t("Open the last result")} onClick={() => onOpenChat(task.lastConversationId)} className="size-9">
                  <MessageSquare size={15} aria-hidden="true" />
                </IconButton>
              )}
              <IconButton label={t("Edit task")} onClick={() => setEditing(task)} className="size-9">
                <Pencil size={15} aria-hidden="true" />
              </IconButton>
              <IconButton label={t("Delete task")} onClick={() => setDeleting(task)} className="size-9">
                <Trash2 size={15} aria-hidden="true" />
              </IconButton>
            </div>
          </Card>
        ))}
      </div>

      <Sheet
        open={editing !== null}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
        title={editing?.id ? t("Edit task") : t("New task")}
      >
        {editing !== null && (
          <TaskForm
            task={editing?.id ? editing : null}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); load(); }}
          />
        )}
      </Sheet>

      <Modal
        open={Boolean(deleting)}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t("Delete this task?")}
        description={t("The task stops. Its chats stay.")}
        footer={(
          <>
            <Button onClick={() => setDeleting(null)}>{t("Cancel")}</Button>
            <Button variant="danger" onClick={confirmDelete}>{t("Delete")}</Button>
          </>
        )}
      />
    </FullPage>
  );
}
