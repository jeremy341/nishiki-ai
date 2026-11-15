import { currentLocale, t } from "../i18n/index.js";
import { Check, ChevronRight, Copy, FileText, Pencil, RotateCw, StickyNote } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import Answer from "../ui/Answer.jsx";
import { Button, IconButton } from "../ui/ui.jsx";

// Charts are a large library: loaded only when an answer actually has one.
const Widgets = lazy(() => import("../ui/Widgets.jsx"));

const isImage = (a) => a.kind === "image" || a.mime?.startsWith("image/");
// The server stores UTC as "YYYY-MM-DD HH:MM:SS". A time we cannot read is simply not shown.
const timeOf = (value) => {
  if (!value) return "";
  const d = new Date(typeof value === "string" && !/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? `${value.replace(" ", "T")}Z` : value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(currentLocale(), { hour: "2-digit", minute: "2-digit" });
};
const domainOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// A folded section under an answer: a small caption row that opens on tap.
function Fold({ label, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3 max-w-[34ch] md:max-w-[68ch]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="caption pressable -ml-1 inline-flex min-h-8 items-center gap-1.5 rounded px-1 text-fg-subtle hover:text-fg pointer-coarse:min-h-11"
      >
        <ChevronRight size={14} strokeWidth={1.5} aria-hidden="true" className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
        {label}
      </button>
      {open && <div className="motion-enter mt-1">{children}</div>}
    </div>
  );
}

// What the model thought before it answered. Folded away; the text is exactly what the model wrote.
export function ThoughtBlock({ text, live = false }) {
  if (!text) return null;
  return (
    <Fold label={live ? t("Thinking…") : t("Thoughts")}>
      <p className="whitespace-pre-wrap break-words border-l border-border-strong pl-3 text-[14px] leading-6 text-fg-muted">{text.trim()}</p>
    </Fold>
  );
}

// Shown after the person confirmed something (a calendar event, a reminder, a sent mail): a check mark, what was done,
// and the details. The result of the action, not a chat answer.
function DoneCard({ widget }) {
  return (
    <div role="status" className="motion-enter flex w-full max-w-[326px] items-start gap-3 rounded-lg border border-accent/40 bg-surface px-4 py-3.5 md:max-w-[28rem]">
      <span className="check-pop mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">
        <Check size={14} strokeWidth={2.25} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="caption">{t("Done")}</div>
        <p className="m-0 mt-0.5 break-words text-[16px] leading-6">{widget.text}</p>
        {widget.details && <p className="m-0 mt-[3px] break-words font-mono text-[13px] leading-5 tracking-[0.02em] text-fg-muted">{widget.details}</p>}
      </div>
    </div>
  );
}

// Your messages sit in a quiet grey block on the right. Answers have no bubble, no avatar
// and no decoration: text, then any chart or table, sources and a copy action.
function FileChip({ file, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(file)}
      className="pressable flex min-h-11 max-w-full items-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-left font-mono text-[13px] hover:border-fg-subtle"
    >
      <FileText size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-fg-muted" />
      <span className="truncate">{file.name}</span>
    </button>
  );
}

// Editing a question: the text box opens in place, and saving asks the assistant again.
function EditQuestion({ value, busy, onSave, onCancel }) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      className="grid w-full gap-2"
      onSubmit={(event) => { event.preventDefault(); if (draft.trim()) onSave(draft.trim()); }}
    >
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        autoFocus
        rows={3}
        maxLength={4000}
        aria-label={t("Edit message")}
        className="w-full resize-none rounded-[18px] border border-border-strong bg-surface px-3.5 py-2.5 text-base leading-6 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>{t("Cancel")}</Button>
        <Button size="sm" variant="primary" type="submit" disabled={busy || !draft.trim()}>{t("Save")}</Button>
      </div>
    </form>
  );
}

export default function Message({ message, onOpenFile, onEdit, onRegenerate, onSaveNote, canRegenerate = false, busy = false }) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const attachments = message.attachments || [];
  const saved = typeof message.id === "number";

  if (message.role === "user") {
    return (
      <div className="motion-enter group flex justify-end">
        <div className="flex w-full flex-col items-end gap-2">
          {attachments.length > 0 && (
            <div className="flex max-w-[78%] flex-wrap justify-end gap-2">
              {attachments.map((a) => (isImage(a) ? (
                <button key={a.id} type="button" onClick={() => onOpenFile?.(a)} className="max-w-full">
                  <img
                    src={a.previewUrl || `/api/attachments/${a.id}`}
                    alt={a.name}
                    loading="lazy"
                    className="max-h-60 max-w-full rounded-[18px] border border-border object-cover"
                  />
                </button>
              ) : (
                <FileChip key={a.id} file={a} onOpen={onOpenFile} />
              )))}
            </div>
          )}
          {editing ? (
            <EditQuestion
              value={message.content}
              busy={busy}
              onCancel={() => setEditing(false)}
              onSave={(content) => { setEditing(false); onEdit?.(message.id, content); }}
            />
          ) : (
            <div className="flex w-full items-center justify-end gap-0.5">
              {saved && onEdit && !busy && (
                <IconButton label={t("Edit message")} onClick={() => setEditing(true)} className="size-11 !text-fg-subtle opacity-100 md:size-9 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100">
                  <Pencil size={18} strokeWidth={1.5} aria-hidden="true" />
                </IconButton>
              )}
              {message.content && (
                <div className="whitespace-pre-wrap break-words max-w-[78%] rounded-[18px] bg-raised px-3.5 py-2.5 text-base leading-6 [text-wrap:pretty]">
                  {message.content}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const sources = message.sources || [];
  const done = (message.widgets || []).find((w) => w.kind === "done");
  const widgets = (message.widgets || []).filter((w) => w.kind !== "done");

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success(t("Copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("Could not copy. Select the text and copy it instead."));
    }
  }

  return (
    <article className="motion-enter group min-w-0 max-w-full text-base leading-[27px]" aria-label={t("Assistant")}>
      {message.activity?.length > 0 && (
        <p className="caption mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {message.activity.map((label) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <Check size={12} aria-hidden="true" /> {t(label)}
            </span>
          ))}
        </p>
      )}
      {message.thinking && <ThoughtBlock text={message.thinking} live={message.id === "streaming" && !message.content} />}
      {done ? <DoneCard widget={done} /> : message.content && <div className="mt-2 max-w-[34ch] md:max-w-[68ch]"><Answer text={message.content} /></div>}
      {attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {attachments.map((a) => (isImage(a) ? (
            <button key={a.id} type="button" onClick={() => onOpenFile?.(a)} className="max-w-full">
              <img src={`/api/attachments/${a.id}`} alt={a.name} loading="lazy"
                className="max-h-60 max-w-full rounded-[18px] border border-border object-cover" />
            </button>
          ) : (
            <FileChip key={a.id} file={a} onOpen={onOpenFile} />
          )))}
        </div>
      )}
      {widgets.length > 0 && (
        <Suspense fallback={null}>
          <Widgets widgets={widgets} />
        </Suspense>
      )}
      {sources.length > 0 && (
        <Fold label={`${t("Sources")} (${sources.length})`}>
          <ul className="grid gap-1 text-[14px] leading-6">
            {sources.map((s) => (
              <li key={s.url} className="min-w-0">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-fg-muted underline decoration-border-strong underline-offset-4 transition-colors duration-150 hover:text-fg hover:decoration-accent"
                >
                  {s.title || domainOf(s.url)}
                </a>
                <span className="caption block truncate normal-case">{domainOf(s.url)}</span>
              </li>
            ))}
          </ul>
        </Fold>
      )}
      {!done && (message.content || canRegenerate) && saved && (
        <div className="-ml-[13px] mt-0.5 flex items-center opacity-100 transition-opacity duration-150 md:-ml-[9px] md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
          {message.content && (
            <IconButton label={copied ? t("Copied") : t("Copy answer")} onClick={copy} className="size-11 !text-fg-subtle hover:!text-fg md:size-9">
              {copied ? <Check size={18} strokeWidth={1.5} aria-hidden="true" /> : <Copy size={18} strokeWidth={1.5} aria-hidden="true" />}
            </IconButton>
          )}
          {message.content && onSaveNote && (
            <IconButton label={t("Save as note")} onClick={() => onSaveNote(message)} className="size-11 !text-fg-subtle hover:!text-fg md:size-9">
              <StickyNote size={18} strokeWidth={1.5} aria-hidden="true" />
            </IconButton>
          )}
          {canRegenerate && onRegenerate && !busy && (
            <IconButton label={t("Generate again")} onClick={() => onRegenerate(message.id)} className="size-11 !text-fg-subtle hover:!text-fg md:size-9">
              <RotateCw size={18} strokeWidth={1.5} aria-hidden="true" />
            </IconButton>
          )}
          {timeOf(message.created_at ?? message.createdAt) && (
            <time className="caption ml-1 tabular-nums">{timeOf(message.created_at ?? message.createdAt)}</time>
          )}
        </div>
      )}
    </article>
  );
}
