import { t } from "../i18n/index.js";
import { Check, Copy, FileText, Pencil, RotateCw, StickyNote } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import Answer from "../ui/Answer.jsx";
import { Button, IconButton } from "../ui/ui.jsx";

// Charts are a large library: loaded only when an answer actually has one.
const Widgets = lazy(() => import("../ui/Widgets.jsx"));

const isImage = (a) => a.kind === "image" || a.mime?.startsWith("image/");
const domainOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// Your messages sit in a quiet grey block on the right. Answers have no bubble, no avatar
// and no decoration: text, then any chart or table, sources and a copy action.
function FileChip({ file, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(file)}
      className="flex max-w-full items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-left text-[13px] transition-colors hover:border-border-strong"
    >
      <FileText size={14} aria-hidden="true" className="shrink-0 text-fg-muted" />
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
        className="w-full resize-none rounded-lg border border-border bg-surface px-3.5 py-2.5 text-base leading-6 focus:border-fg-subtle focus:outline-none md:text-[15px]"
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
        <div className="flex max-w-[85%] flex-col items-end gap-2 md:max-w-[70%]">
          {attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {attachments.map((a) => (isImage(a) ? (
                <button key={a.id} type="button" onClick={() => onOpenFile?.(a)} className="max-w-full">
                  <img
                    src={a.previewUrl || `/api/attachments/${a.id}`}
                    alt={a.name}
                    loading="lazy"
                    className="max-h-60 max-w-full rounded-md border border-border object-cover"
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
            <div className="flex items-start gap-0.5">
              {saved && onEdit && !busy && (
                <IconButton label={t("Edit message")} onClick={() => setEditing(true)} className="size-11 opacity-100 md:size-8 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-visible:opacity-100">
                  <Pencil size={14} aria-hidden="true" />
                </IconButton>
              )}
              {message.content && (
                <div className="whitespace-pre-wrap break-words rounded-lg bg-raised px-3.5 py-2 text-[15px] leading-6">
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
  const widgets = message.widgets || [];

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
    <article className="motion-enter group min-w-0 text-[15px] leading-7 md:text-base" aria-label={t("Assistant")}>
      {message.activity?.length > 0 && (
        <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs leading-5 text-fg-subtle">
          {message.activity.map((label) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <Check size={12} aria-hidden="true" /> {label}
            </span>
          ))}
        </p>
      )}
      {message.content && <Answer text={message.content} />}
      {attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {attachments.map((a) => (isImage(a) ? (
            <button key={a.id} type="button" onClick={() => onOpenFile?.(a)} className="max-w-full">
              <img src={`/api/attachments/${a.id}`} alt={a.name} loading="lazy"
                className="max-h-60 max-w-full rounded-md border border-border object-cover" />
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
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-5 text-fg-subtle">
          <span className="font-mono text-xs uppercase tracking-wider">{t("Sources")}</span>
          {sources.map((s) => (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-[16rem] truncate text-fg-muted underline decoration-border-strong underline-offset-4 hover:text-fg"
            >
              {s.title || domainOf(s.url)}
            </a>
          ))}
        </div>
      )}
      {(message.content || canRegenerate) && saved && (
        <div className="-ml-2 mt-2 flex items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
          {message.content && (
            <IconButton label={copied ? t("Copied") : t("Copy answer")} onClick={copy} className="size-9 md:size-8">
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            </IconButton>
          )}
          {message.content && onSaveNote && (
            <IconButton label={t("Save as note")} onClick={() => onSaveNote(message)} className="size-9 md:size-8">
              <StickyNote size={14} aria-hidden="true" />
            </IconButton>
          )}
          {canRegenerate && onRegenerate && !busy && (
            <IconButton label={t("Generate again")} onClick={() => onRegenerate(message.id)} className="size-9 md:size-8">
              <RotateCw size={14} aria-hidden="true" />
            </IconButton>
          )}
        </div>
      )}
    </article>
  );
}
