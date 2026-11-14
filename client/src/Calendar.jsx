import Loading from "./ui/Loading.jsx";
import { currentLocale, t } from "./i18n/index.js";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "./api.js";
import { Button, Card, Field, FullPage, Input } from "./ui/ui.jsx";

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function formatWhen(start, allDay) {
  if (!start) return "";
  const date = new Date(start);
  if (allDay) return date.toLocaleDateString(currentLocale(), { weekday: "short", day: "numeric", month: "short" });
  return date.toLocaleString(currentLocale(), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Google Calendar: upcoming events, and new events that are only created after Confirm.
export default function CalendarPanel({ open, onOpenChange, google, onChanged }) {
  const connected = Boolean(google?.connected);
  const [events, setEvents] = useState(null);
  const [text, setText] = useState("");
  const [question, setQuestion] = useState("");
  const [proposal, setProposal] = useState(null);
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

  async function disconnect() {
    setBusy(true);
    try {
      await api("/api/google/disconnect", { method: "POST", body: {} });
      setEvents(null);
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
        <div className="grid gap-4 py-4 text-center">
          <CalendarDays size={40} aria-hidden="true" className="mx-auto text-fg-muted" />
          <p className="text-fg-muted">            {t("Connect your Google account. The app only asks to view and create calendar events. It never sees your password.")}          </p>
          <div>
            <Button variant="primary" onClick={() => { window.location.href = "/api/google/connect"; }}>{t("Connect Google Calendar")}</Button>
          </div>
        </div>
      )}

      {connected && (
        <div className="grid gap-7">
          <section className="grid gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{t("Next 7 days")}</h3>
              <Button variant="ghost" size="sm" onClick={disconnect} disabled={busy}>{t("Disconnect")}</Button>
            </div>
            {events === null && !error && <Loading />}
            {events && events.length === 0 && <p className="text-fg-muted">{t("Nothing scheduled.")}</p>}
            {events && events.length > 0 && (
              <Card className="divide-y divide-border">
                {events.map((ev) => (
                  <div key={ev.id} className="grid gap-0.5 px-4 py-3">
                    <span className="text-xs text-fg-muted">{formatWhen(ev.start, ev.allDay)}</span>
                    <span className="truncate">{ev.title}</span>
                  </div>
                ))}
              </Card>
            )}
          </section>

          <section className="grid gap-3">
            <h3 className="text-sm font-semibold">{t("Add an event")}</h3>
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={propose}>
              <Field label={t("Describe the event")} className="flex-1">
                <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={t("Coffee with Sam tomorrow at 10")} />
              </Field>
              <div className="sm:self-end">
                <Button type="submit" disabled={busy || !text.trim()}>{t("Suggest")}</Button>
              </div>
            </form>
            {question && <p className="rounded-xl bg-raised px-4 py-2.5 text-sm">{question}</p>}
            {proposal && (
              <Card className="grid gap-4 p-5">
                <p className="text-sm text-fg-muted">{t("Check before adding. Nothing is saved yet.")}</p>
                <Field label={t("Title")}><Input value={proposal.title} maxLength={200} onChange={(e) => setProposal({ ...proposal, title: e.target.value })} /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("Start")}><Input type="datetime-local" value={proposal.start} onChange={(e) => setProposal({ ...proposal, start: e.target.value })} /></Field>
                  <Field label={t("End")}><Input type="datetime-local" value={proposal.end} onChange={(e) => setProposal({ ...proposal, end: e.target.value })} /></Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={createEvent} disabled={busy}>{t("Add to Google Calendar")}</Button>
                  <Button onClick={() => setProposal(null)} disabled={busy}>{t("Discard")}</Button>
                </div>
              </Card>
            )}
          </section>
        </div>
      )}

      {error && <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">{error}</p>}
    </FullPage>
  );
}
