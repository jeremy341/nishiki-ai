import Loading from "./ui/Loading.jsx";
import { FileText, MessageSquare, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "./api.js";
import { currentLocale, t } from "./i18n/index.js";
import { Button, Card, FullPage, IconButton, Modal } from "./ui/ui.jsx";

// The Library: every file you sent or received, kept on this server. Images show as previews.
const FILTERS = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "doc", label: "Documents" },
];

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

export default function Library({ onClose, onOpenChat, onOpenFile }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [deleting, setDeleting] = useState(null);

  function load() {
    api("/api/library")
      .then(setData)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/library/${deleting.id}`, { method: "DELETE", body: {} });
      setDeleting(null);
      toast.success(t("File deleted"));
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const items = (data?.items || []).filter((item) => (
    filter === "all" || (filter === "image" ? item.kind === "image" : item.kind !== "image")
  ));
  const used = data?.storage.usedBytes || 0;
  const limit = data?.storage.limitBytes || 1;
  const percent = Math.min(100, Math.round((used / limit) * 100));

  return (
    <FullPage title={t("Library")} onClose={onClose}>
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger">{error}</p>}
      {!data && !error && <Loading />}
      {data && (
        <div className="grid gap-6">
          <Card className="grid gap-3 p-5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{t("Storage")}</span>
              <span className="text-fg-muted tabular-nums">{t("{used} of {limit} used", { used: formatSize(used), limit: formatSize(limit) })}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-raised" role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-xs text-fg-subtle">{t("Files are kept on the server. Delete what you no longer need to make room.")}</p>
          </Card>

          <div className="flex gap-1" role="tablist" aria-label={t("Filter")}>
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={`h-8 rounded-md px-3 text-sm transition-colors ${
                  filter === f.value ? "bg-raised text-fg" : "text-fg-muted hover:text-fg"
                }`}
              >
                {t(f.label)}
              </button>
            ))}
          </div>

          {!items.length && <Card className="px-5 py-10 text-center text-fg-muted">{t("No files yet. Photos and PDFs you send appear here.")}</Card>}

          {items.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <li key={item.id} className="flex gap-3 rounded-lg border border-border p-3">
                  {item.kind === "image" ? (
                    <img src={`/api/attachments/${item.id}`} alt="" loading="lazy"
                      className="size-16 shrink-0 rounded-md border border-border object-cover" />
                  ) : (
                    <span className="grid size-16 shrink-0 place-items-center rounded-md bg-raised">
                      <FileText size={22} aria-hidden="true" className="text-fg-muted" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => onOpenFile?.(item)}
                      className="block max-w-full truncate text-left text-sm font-medium hover:underline">{item.name}</button>
                    <div className="mt-0.5 text-xs text-fg-subtle tabular-nums">
                      {formatSize(item.size)} · {new Date(`${item.createdAt.replace(" ", "T")}Z`).toLocaleDateString(currentLocale(), { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                    {item.chat && <div className="mt-0.5 truncate text-xs text-fg-muted">{item.chat}</div>}
                    <div className="mt-2 flex gap-1">
                      {item.conversationId && (
                        <IconButton label={t("Open the chat")} onClick={() => onOpenChat(item.conversationId)} className="size-8">
                          <MessageSquare size={15} aria-hidden="true" />
                        </IconButton>
                      )}
                      <IconButton label={t("Delete {name}", { name: item.name })} onClick={() => setDeleting(item)} className="size-8">
                        <Trash2 size={15} aria-hidden="true" />
                      </IconButton>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <Modal
        open={Boolean(deleting)}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t("Delete this file?")}
        description={t("The file is removed from the server. This cannot be undone.")}
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
