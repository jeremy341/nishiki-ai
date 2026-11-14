import { MessageSquare, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "./api.js";
import { currentLocale, t } from "./i18n/index.js";
import KoiEmpty from "./ui/KoiEmpty.jsx";
import KoiGlyph from "./ui/KoiGlyph.jsx";
import { Button, Field, FullPage, IconButton, Input, Modal, Select, Sheet, Switch, Textarea } from "./ui/ui.jsx";

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
        <Textarea
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
      <div className="grid gap-8">
        <div className="flex items-center justify-between gap-4">
          <p className="caption max-w-[32ch] normal-case">{t("The assistant answers these by itself, in their own chat.")}</p>
          <Button variant="primary" className="shrink-0 whitespace-nowrap max-md:h-11" onClick={() => setEditing({})}><Plus size={16} strokeWidth={1.5} aria-hidden="true" /> {t("New task")}</Button>
        </div>

        {error && <p role="alert" className="field-error">{error}</p>}

        {tasks === null && !error && (
          <div role="status" aria-busy="true" className="flex items-center gap-3 py-12">
            <KoiGlyph swim size={32} />
            <span className="caption">{t("Loading…")}</span>
          </div>
        )}

        {tasks && !tasks.length && (
          <KoiEmpty
            title={t("No scheduled tasks yet")}
            hint={t("For example: every weekday at 8:00, a short summary of my calendar and mail.")}
          />
        )}

        {tasks?.length > 0 && (
          <ul className="divide-y divide-border">
            {tasks.map((task) => (
              <li key={task.id} className="grid gap-2.5 py-5 first:pt-1">
                <div className="flex min-h-11 items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className={`truncate text-[15px] ${task.enabled ? "" : "text-fg-muted"}`}>{task.title}</div>
                    <div className="caption mt-0.5 tabular-nums">{scheduleText(task)}</div>
                  </div>
                  <Switch checked={task.enabled} onCheckedChange={(v) => toggle(task, v)} label={t("On")} />
                </div>
                <p className="line-clamp-2 text-[14px] leading-6 text-fg-muted">{task.prompt}</p>
                <div className="caption grid gap-0.5 tabular-nums">
                  {task.enabled && task.nextRun && <span className="text-accent">{t("Next: {when}", { when: whenText(task.nextRun) })}</span>}
                  {task.lastRun && <span>{t("Last ran {when}", { when: whenText(task.lastRun) })}</span>}
                  {task.lastError && <span className="normal-case text-danger">{task.lastError}</span>}
                </div>
                <div className="-mb-1.5 flex flex-wrap items-center gap-1">
                  <Button size="sm" onClick={() => runNow(task)} className="max-md:h-11"><Play size={13} strokeWidth={1.5} aria-hidden="true" /> {t("Run now")}</Button>
                  {task.lastConversationId && (
                    <IconButton label={t("Open the last result")} onClick={() => onOpenChat(task.lastConversationId)} className="size-11 md:size-8">
                      <MessageSquare size={16} strokeWidth={1.5} aria-hidden="true" />
                    </IconButton>
                  )}
                  <IconButton label={t("Edit task")} onClick={() => setEditing(task)} className="size-11 md:size-8">
                    <Pencil size={16} strokeWidth={1.5} aria-hidden="true" />
                  </IconButton>
                  <IconButton label={t("Delete task")} onClick={() => setDeleting(task)} className="size-11 md:size-8">
                    <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}
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
