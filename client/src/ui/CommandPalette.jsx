import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { t } from "../i18n/index.js";

// The command palette (Cmd/Ctrl+K): type a few letters to find a chat or an action, then Enter.
// Arrow keys move through the results. The list is built by the page; this only filters and runs it.
export default function CommandPalette({ open, onOpenChange, commands }) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const items = commands.filter((c) => !q || `${c.label} ${c.group || ""}`.toLowerCase().includes(q)).slice(0, 40);

  function run(item) {
    onOpenChange(false);
    item.run();
  }

  function onKey(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (items[index]) run(items[index]);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="motion-overlay fixed inset-0 z-50 bg-scrim" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="motion-dialog fixed left-1/2 top-[12vh] z-50 w-[min(92vw,560px)] -translate-x-1/2 overflow-hidden rounded-xl border border-border-strong bg-overlay outline-none"
        >
          <DialogPrimitive.Title className="sr-only">{t("Command palette")}</DialogPrimitive.Title>
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
            onKeyDown={onKey}
            placeholder={t("Search chats and commands")}
            aria-label={t("Search chats and commands")}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={items[index] ? `command-${items[index].id}` : undefined}
            className="h-12 w-full border-b border-border bg-transparent px-4 text-[16px] placeholder:text-fg-subtle focus:outline-none focus-visible:border-accent"
          />
          <ul id="command-list" role="listbox" className="quiet-scroll max-h-[55vh] overflow-y-auto p-2">
            {items.map((c, i) => (
              <li key={c.id} id={`command-${c.id}`} role="option" aria-selected={i === index}>
                <button
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => run(c)}
                  className={`flex min-h-9 w-full items-center gap-3 rounded-md px-3 py-1.5 text-left font-mono text-[13px] font-medium transition-colors pointer-coarse:min-h-11 ${
                    i === index ? "bg-raised" : ""
                  }`}
                >
                  {c.icon && <c.icon size={17} aria-hidden="true" className="shrink-0 text-fg-muted" />}
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {c.group && <span className="caption shrink-0">{c.group}</span>}
                </button>
              </li>
            ))}
            {!items.length && <li className="px-3 py-8 text-center font-mono text-[13px] text-fg-muted">{t("Nothing found")}</li>}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
