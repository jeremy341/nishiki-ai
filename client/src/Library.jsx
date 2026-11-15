import { MessageSquare, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { toast } from "sonner";
import { api } from "./api.js";
import { currentLocale, t } from "./i18n/index.js";
import KoiEmpty from "./ui/KoiEmpty.jsx";
import KoiGlyph from "./ui/KoiGlyph.jsx";
import StaggerOnce from "./ui/StaggerOnce.jsx";
import { Button, FullPage, IconButton, Modal } from "./ui/ui.jsx";

// The Library: every file you sent or received, kept on this server. Images show as previews.
// A quiet page (DESIGN.md): one hairline-divided list, 64px rows, mono captions for size and date, no pond.
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
      {error && <p role="alert" className="field-error">{error}</p>}
      {!data && !error && (
        <div role="status" className="flex items-center gap-3 py-12">
          <KoiGlyph swim size={32} />
          <span className="caption">{t("Loading…")}</span>
        </div>
      )}
      {data && (
        <div className="grid gap-10">
          <section className="grid gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="caption">{t("Storage")}</span>
              <span className="mono-num text-fg-muted">{t("{used} of {limit} used", { used: formatSize(used), limit: formatSize(limit) })}</span>
            </div>
            <div className="h-0.5 overflow-hidden bg-border-strong" role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-fg-muted" style={{ width: `${percent}%` }} />
            </div>
            <p className="caption normal-case">{t("Files are kept on the server. Delete what you no longer need to make room.")}</p>
          </section>

          <TabsPrimitive.Root value={filter} onValueChange={setFilter}>
            <TabsPrimitive.List className="flex gap-6 border-b border-border" aria-label={t("Filter")}>
              {FILTERS.map((f) => (
                <TabsPrimitive.Trigger
                  key={f.value}
                  value={f.value}
                  className={`pressable -mb-px h-11 min-w-11 border-b-2 font-mono text-[13px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                    filter === f.value ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg"
                  }`}
                >
                  {t(f.label)}
                </TabsPrimitive.Trigger>
              ))}
            </TabsPrimitive.List>
            <TabsPrimitive.Content value={filter} className="mt-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">

              {!items.length && (data.items?.length ? (
                <KoiEmpty title={t("No files match this filter.")}>
                  <Button onClick={() => setFilter("all")}>{t("All")}</Button>
                </KoiEmpty>
              ) : (
                <KoiEmpty title={t("No files yet. Photos and PDFs you send appear here.")} />
              ))}

              {items.length > 0 && (
                <StaggerOnce className="divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.id} className="flex min-h-16 items-center gap-4 py-2.5">
                      {item.kind === "image" ? (
                        <img src={`/api/attachments/${item.id}`} alt="" loading="lazy"
                          className="size-11 shrink-0 rounded-md border border-border object-cover" />
                      ) : (
                        <span className="grid size-11 shrink-0 place-items-center rounded-md border border-border font-mono text-[10px] uppercase text-fg-subtle">
                          {(item.name.split(".").pop() || "file").slice(0, 4)}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <button type="button" onClick={() => onOpenFile?.(item)}
                          className="block min-h-6 max-w-full truncate text-left text-[15px] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">{item.name}</button>
                        <div className="caption truncate tabular-nums">
                          {formatSize(item.size)} · {new Date(`${item.createdAt.replace(" ", "T")}Z`).toLocaleDateString(currentLocale(), { day: "numeric", month: "short", year: "numeric" })}
                          {item.chat ? ` · ${item.chat}` : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0">
                        {item.conversationId && (
                          <IconButton label={t("Open the chat")} onClick={() => onOpenChat(item.conversationId)} className="size-11">
                            <MessageSquare size={16} strokeWidth={1.5} aria-hidden="true" />
                          </IconButton>
                        )}
                        <IconButton label={t("Delete {name}", { name: item.name })} onClick={() => setDeleting(item)} className="size-11">
                          <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
                        </IconButton>
                      </div>
                    </li>
                  ))}
                </StaggerOnce>
              )}
            </TabsPrimitive.Content>
          </TabsPrimitive.Root>
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
