import { currentLocale, t } from "./i18n/index.js";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "./api.js";
import KoiEmpty from "./ui/KoiEmpty.jsx";
import KoiGlyph from "./ui/KoiGlyph.jsx";
import WaveRule from "./ui/WaveRule.jsx";
import { Button, Field, FullPage, Input, Select } from "./ui/ui.jsx";

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function formatWhen(start, allDay) {
  if (!start) return "";
  const date = new Date(allDay ? start + "T12:00:00" : start);
  if (allDay) return date.toLocaleDateString(currentLocale(), { weekday: "short", day: "numeric", month: "short" });
  return date.toLocaleString(currentLocale(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Use the browser's time zone for editing, not the UTC portion of the ISO string.
function toEditInput(value, allDay) {
  if (!value) return "";
  if (allDay) return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("sv-SE", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).replace(" ", "T").slice(0, 16);
}

// Google Calendar: upcoming events, plus explicit edits and deletions of existing events.
export default function CalendarPanel({ open, onOpenChange, google, onChanged }) {
  const connected = Boolean(google?.connected);
  const [events, setEvents] = useState(null);
  const [text, setText] = useState("");
  const [question, setQuestion] = useState("");
  const [proposal, setProposal] = useState(null);
  const [selection, setSelection] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && connected) loadEvents();
    // Load when the panel opens or the connection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, connected]);

  async function loadEvents() {
    setError("");
    try {
      const data = await api("/api/calendar/events");
      setEvents(data.events);
    } catch (err) {
      setError(err.message);
    }
  }

  async function propose(event) {
    event.preventDefault();
    setError("");
    setQuestion("");
    setProposal(null);
    setBusy(true);
    try {
      const data = await api("/api/calendar/propose", { method: "POST", body: { text, timeZone: TIME_ZONE } });
      if (data.needsClarification) setQuestion(data.question);
      else setProposal(data.proposal);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Nothing is written until the user presses this button.
  async function createEvent() {
    if (!proposal) return;
    if (!proposal.title.trim() || !proposal.start || !proposal.end) {
      setError(t("Fill in a title, start and end."));
      return;
    }
    if (proposal.end <= proposal.start) {
      setError(t("The end must be after the start."));
      return;
    }
    setError("");
    setBusy(true);
    try {
      await api("/api/calendar/create", { method: "POST", body: { confirmed: true, ...proposal, timeZone: TIME_ZONE } });
      toast.success(`Added “${proposal.title}” to your calendar`);
      setProposal(null);
      setText("");
      loadEvents();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // A recurring occurrence and its parent series are different Google events.
  // Load the selected target from the server so its revision and original values are correct.
  async function selectEvent(id, mode, scope = "single") {
    setError("");
    setSelection({ id, mode, scope, event: null });
    setDraft(null);
    setBusy(true);
    try {
      const data = await api("/api/calendar/events/" + encodeURIComponent(id) + "?scope=" + scope);
      const ev = data.event;
      setSelection({ id, mode, scope, event: ev });
      setDraft({ title: ev.title, start: toEditInput(ev.start, ev.allDay), end: toEditInput(ev.end, ev.allDay) });
    } catch (err) {
      setError(err.message);
      setSelection(null);
    } finally {
      setBusy(false);
    }
  }

  async function saveSelected() {
    if (!selection?.event || !draft) return;
    const ev = selection.event;
    const changedTitle = draft.title.trim() !== ev.title;
    const changedTimes = draft.start !== toEditInput(ev.start, ev.allDay) || draft.end !== toEditInput(ev.end, ev.allDay);
    if (!draft.title.trim()) return setError(t("The event needs a title."));
    if (changedTimes && (!draft.start || !draft.end || draft.end <= draft.start)) {
      return setError(t("The end must be after the start."));
    }
    if (!changedTitle && !changedTimes) return setError(t("No changes to save."));
    setBusy(true);
    setError("");
    try {
      const body = { confirmed: true, scope: selection.scope, etag: ev.etag, timeZone: TIME_ZONE };
      if (changedTitle) body.title = draft.title.trim();
      if (changedTimes) { body.start = draft.start; body.end = draft.end; }
      await api("/api/calendar/events/" + encodeURIComponent(selection.id), { method: "PATCH", body });
      toast.success(t("Calendar event updated"));
      setSelection(null);
      setDraft(null);
      await loadEvents();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!selection?.event) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/calendar/events/" + encodeURIComponent(selection.id), {
        method: "DELETE",
        body: { confirmed: true, scope: selection.scope, etag: selection.event.etag },
      });
      toast.success(t("Calendar event deleted"));
      setSelection(null);
      setDraft(null);
      await loadEvents();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await api("/api/google/disconnect", { method: "POST", body: {} });
      setEvents(null);
      setSelection(null);
      setDraft(null);
      toast.success(t("Google Calendar disconnected"));
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FullPage title={t("Calendar")} onClose={() => onOpenChange(false)}>
      {!connected && (
        <KoiEmpty title={t("Connect your Google account. The app only asks to view and create calendar events. It never sees your password.")}>
          <Button variant="primary" className="max-md:h-11" onClick={() => { window.location.href = "/api/google/connect"; }}>{t("Connect Google Calendar")}</Button>
        </KoiEmpty>
      )}

      {connected && (
        <div className="grid gap-10">
          <section className="grid gap-3">
            <div className="flex min-h-11 items-center justify-between">
              <h3 className="caption">{t("Next 7 days")}</h3>
              <Button variant="ghost" size="sm" className="max-md:h-11" onClick={disconnect} disabled={busy}>{t("Disconnect")}</Button>
            </div>
            {events === null && !error && (
              <div role="status" className="flex items-center gap-3 py-10">
                <KoiGlyph swim size={32} />
                <span className="caption">{t("Loading…")}</span>
              </div>
            )}
            {events && events.length === 0 && <KoiEmpty title={t("Nothing scheduled.")} className="py-8" />}
            {events && events.length > 0 && (
              <ul className="divide-y divide-border">
                {events.map((ev, i) => (
                  <li key={ev.id} className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <span className={i === 0 ? "caption mono-num tabular-nums !text-accent" : "caption mono-num tabular-nums"}>{formatWhen(ev.start, ev.allDay)}</span>
                      <p className="min-w-0 whitespace-normal break-words text-[15px]">{ev.title}</p>
                      {ev.recurringEventId && <span className="caption">{t("Repeating event")}</span>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => selectEvent(ev.id, "edit")}>{t("Edit")}</Button>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => selectEvent(ev.id, "delete")}>{t("Delete")}</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selection && (
            <section className="grid gap-4 rounded-lg border border-border-strong bg-surface p-4">
              <h3 className="caption">{selection.mode === "edit" ? t("Edit calendar event") : t("Delete calendar event")}</h3>
              {selection.event && draft ? (
                <>
                  <p className="text-[15px]">{selection.event.title}</p>
                  {selection.event.isRecurring && (
                    <Field label={t("Apply to")}>
                      <Select value={selection.scope} disabled={busy} onChange={(e) => selectEvent(selection.id, selection.mode, e.target.value)}>
                        <option value="single">{t("Only this occurrence")}</option>
                        <option value="series">{t("Entire repeating series")}</option>
                      </Select>
                    </Field>
                  )}
                  {selection.mode === "edit" ? (
                    <>
                      <Field label={t("Title")}>
                        <Input maxLength={200} value={draft.title} disabled={busy} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t("Start")}>
                          <Input type={selection.event.allDay ? "date" : "datetime-local"} value={draft.start} disabled={busy} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
                        </Field>
                        <Field label={t("End")}>
                          <Input type={selection.event.allDay ? "date" : "datetime-local"} value={draft.end} disabled={busy} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
                        </Field>
                      </div>
                      {selection.event.allDay && <p className="caption">{t("All-day end dates are exclusive.")}</p>}
                      <p className="caption">{t("Nothing changes until you confirm.")}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="primary" disabled={busy} onClick={saveSelected}>{t("Save changes")}</Button>
                        <Button disabled={busy} onClick={() => setSelection(null)}>{t("Cancel")}</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-[15px]">{t("Delete this event? This cannot be undone.")}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="danger" disabled={busy} onClick={deleteSelected}>{t("Confirm deletion")}</Button>
                        <Button disabled={busy} onClick={() => setSelection(null)}>{t("Cancel")}</Button>
                      </div>
                    </>
                  )}
                </>
              ) : <p className="caption">{t("Loading…")}</p>}
            </section>
          )}

          <WaveRule />

          <section className="grid gap-3">
            <h3 className="caption">{t("Add an event")}</h3>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={propose}>
              <Field label={t("Describe the event")} className="flex-1">
                <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={t("Coffee with Sam tomorrow at 10")} />
              </Field>
              <div className="sm:self-end">
                <Button type="submit" className="max-md:h-11" disabled={busy || !text.trim()}>{t("Suggest")}</Button>
              </div>
            </form>
            {question && <p className="rounded-md border border-border-strong bg-surface px-3 py-2 text-[15px]">{question}</p>}
            {proposal && (
              <div className="grid gap-4 rounded-lg border border-border-strong bg-surface p-4">
                <p className="caption normal-case">{t("Check before adding. Nothing is saved yet.")}</p>
                <Field label={t("Title")}><Input value={proposal.title} maxLength={200} onChange={(e) => setProposal({ ...proposal, title: e.target.value })} /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("Start")}><Input type="datetime-local" value={proposal.start} onChange={(e) => setProposal({ ...proposal, start: e.target.value })} /></Field>
                  <Field label={t("End")}><Input type="datetime-local" value={proposal.end} onChange={(e) => setProposal({ ...proposal, end: e.target.value })} /></Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" className="max-md:h-11" onClick={createEvent} disabled={busy}>{t("Add to Google Calendar")}</Button>
                  <Button className="max-md:h-11" onClick={() => setProposal(null)} disabled={busy}>{t("Discard")}</Button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {error && <p role="alert" className="field-error mt-4">{error}</p>}
    </FullPage>
  );
}
