import {
  CalendarClock, ChevronDown, ChevronRight, FolderInput, FolderPlus, LayoutGrid, Library, MoreHorizontal, Pencil,
  Pin, PinOff, Plus, Search, Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { currentLocale, t } from "../i18n/index.js";
import { IconButton, Menu, MenuItem, MenuSeparator } from "../ui/ui.jsx";

// The sidebar, like the ChatGPT one: navigation, pinned chats, projects, then recent chats by day.
// It is used in the sidebar on wide screens and in the drawer on phones.

const DAY = 24 * 60 * 60 * 1000;

// SQLite timestamps are UTC without a zone.
function dayGroup(iso) {
  const time = new Date(`${String(iso).replace(" ", "T")}Z`).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (time >= today) return "today";
  if (time >= today - DAY) return "yesterday";
  if (time >= today - 7 * DAY) return "week";
  return "older";
}

const GROUP_LABEL = { today: "Today", yesterday: "Yesterday", week: "Previous 7 days", older: "Older" };

function NavItem({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm text-fg-muted transition-colors hover:bg-raised hover:text-fg md:h-8"
    >
      <Icon size={16} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div className="flex min-h-6 items-center justify-between px-2 pb-1 pt-4 font-mono text-[11px] uppercase tracking-wider text-fg-subtle">
      <span>{children}</span>
      {action}
    </div>
  );
}

function ChatRow({ chat, active, onSelect, onRename, onDelete, onTogglePin, onMove }) {
  const title = chat.title || t("New chat");
  return (
    <li className={`group flex items-center rounded-md transition-colors ${active ? "bg-raised" : "hover:bg-raised/50"}`}>
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect(chat.id)}
        className={`h-11 md:h-8 min-w-0 flex-1 overflow-hidden whitespace-nowrap fade-end rounded-md px-2 text-left text-sm ${
          active ? "text-fg" : "text-fg-muted hover:text-fg"
        }`}
      >
        {chat.pinned && <Pin size={11} aria-hidden="true" className="-mt-0.5 mr-1.5 inline text-fg-subtle" />}
        {title}
      </button>
      <Menu
        trigger={(
          <button
            type="button"
            aria-label={t("Options for {title}", { title })}
            className="mr-0.5 grid size-11 shrink-0 place-items-center rounded-md text-fg-subtle opacity-100 hover:text-fg md:size-8 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        )}
      >
        <MenuItem icon={Pencil} onSelect={() => onRename(chat)}>{t("Rename")}</MenuItem>
        <MenuItem icon={chat.pinned ? PinOff : Pin} onSelect={() => onTogglePin(chat)}>
          {chat.pinned ? t("Unpin") : t("Pin")}
        </MenuItem>
        <MenuItem icon={FolderInput} onSelect={() => onMove(chat)}>{t("Move to project")}</MenuItem>
        <MenuSeparator />
        <MenuItem icon={Trash2} destructive onSelect={() => onDelete(chat)}>{t("Delete")}</MenuItem>
      </Menu>
    </li>
  );
}

function ChatList({ chats, ...rest }) {
  return (
    <ul className="grid gap-px">
      {chats.map((chat) => <ChatRow key={chat.id} chat={chat} active={chat.id === rest.activeId} {...rest} />)}
    </ul>
  );
}

function ProjectRow({ project, chats, open, onToggle, onNewChat, onEdit, onDelete, ...rest }) {
  return (
    <div>
      <div className="group flex items-center rounded-md hover:bg-raised/50">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 text-left text-sm text-fg-muted hover:text-fg md:h-8"
        >
          {open ? <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-fg-subtle" /> : <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-fg-subtle" />}
          <span className="truncate">{project.name}</span>
        </button>
        <Menu
          trigger={(
            <button
              type="button"
              aria-label={t("Options for {title}", { title: project.name })}
              className="mr-0.5 grid size-11 shrink-0 place-items-center rounded-md text-fg-subtle opacity-100 hover:text-fg md:size-8 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </button>
          )}
        >
          <MenuItem icon={Plus} onSelect={() => onNewChat(project)}>{t("New chat in project")}</MenuItem>
          <MenuItem icon={Pencil} onSelect={() => onEdit(project)}>{t("Edit project")}</MenuItem>
          <MenuSeparator />
          <MenuItem icon={Trash2} destructive onSelect={() => onDelete(project)}>{t("Delete project")}</MenuItem>
        </Menu>
      </div>
      {open && (
        <div className="ml-3 border-l border-border pl-1">
          {chats.length ? <ChatList chats={chats} {...rest} /> : (
            <p className="px-2 py-1.5 text-[13px] text-fg-subtle">{t("No chats in this project yet.")}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  conversations, projects, activeId,
  onSelect, onNewChat, onNewChatInProject, onRename, onDelete, onTogglePin, onMove,
  onNewProject, onEditProject, onDeleteProject, onOpenLibrary, onOpenTasks, onOpenApps,
}) {
  const [closed, setClosed] = useState({});
  const [query, setQuery] = useState("");
  const [found, setFound] = useState(null);

  // Search runs on the server, a moment after typing stops.
  useEffect(() => {
    const q = query.trim();
    if (!q) { setFound(null); return undefined; }
    const timer = setTimeout(() => {
      api(`/api/conversations/search?q=${encodeURIComponent(q)}`)
        .then((data) => setFound(data.results))
        .catch(() => setFound([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  const rowProps = { activeId, onSelect, onRename, onDelete, onTogglePin, onMove };
  const pinned = conversations.filter((c) => c.pinned);
  const recent = conversations.filter((c) => !c.pinned && !c.projectId);
  const groups = { today: [], yesterday: [], week: [], older: [] };
  for (const chat of recent) groups[dayGroup(chat.updated_at)].push(chat);

  return (
    <div className="quiet-scroll flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
      <label className="mb-2 flex h-11 items-center gap-2 rounded-md border border-border px-2.5 focus-within:border-fg-subtle md:h-9">
        <Search size={15} aria-hidden="true" className="shrink-0 text-fg-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search chats")}
          aria-label={t("Search chats")}
          className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-fg-subtle focus:outline-none"
        />
      </label>
      {found !== null && (
        <ul className="grid gap-px" aria-label={t("Search chats")}>
          {found.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => { setQuery(""); onSelect(r.id); }}
                className="grid min-h-11 w-full gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-raised/50"
              >
                <span className="truncate text-sm">{r.title || t("New chat")}</span>
                {r.snippet && <span className="line-clamp-2 text-[13px] text-fg-muted">{r.snippet}</span>}
                <span className="font-mono text-[11px] text-fg-subtle">{new Date(`${String(r.updatedAt).replace(" ", "T")}Z`).toLocaleDateString(currentLocale(), { day: "numeric", month: "short" })}</span>
              </button>
            </li>
          ))}
          {!found.length && <li className="px-2 py-2 text-sm text-fg-subtle">{t("No chats found.")}</li>}
        </ul>
      )}
      {found === null && (
      <>
      <nav className="grid gap-px" aria-label={t("Chats")}>
        <NavItem icon={Plus} label={t("New chat")} onClick={() => onNewChat()} />
        <NavItem icon={Library} label={t("Library")} onClick={onOpenLibrary} />
        <NavItem icon={CalendarClock} label={t("Scheduled tasks")} onClick={onOpenTasks} />
        <NavItem icon={LayoutGrid} label={t("Apps")} onClick={onOpenApps} />
      </nav>

      {pinned.length > 0 && (
        <section>
          <SectionTitle>{t("Pinned")}</SectionTitle>
          <ChatList chats={pinned} {...rowProps} />
        </section>
      )}

      <section>
        <SectionTitle
          action={(
            <IconButton label={t("New project")} onClick={onNewProject} className="size-8">
              <FolderPlus size={15} aria-hidden="true" />
            </IconButton>
          )}
        >
          {t("Projects")}
        </SectionTitle>
        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            chats={conversations.filter((c) => c.projectId === project.id && !c.pinned)}
            open={!closed[project.id]}
            onToggle={() => setClosed((s) => ({ ...s, [project.id]: !s[project.id] }))}
            onNewChat={onNewChatInProject}
            onEdit={onEditProject}
            onDelete={onDeleteProject}
            {...rowProps}
          />
        ))}
        {!projects.length && (
          <p className="px-2 py-1.5 text-[13px] text-fg-subtle">
            {t("Projects group chats and give them shared instructions.")}
          </p>
        )}
      </section>

      {Object.entries(groups).map(([key, chats]) => (chats.length ? (
        <section key={key}>
          <SectionTitle>{t(GROUP_LABEL[key])}</SectionTitle>
          <ChatList chats={chats} {...rowProps} />
        </section>
      ) : null))}

      {!conversations.length && <p className="px-2 py-2 text-[13px] text-fg-subtle">{t("Your chats will appear here.")}</p>}
      </>)}
    </div>
  );
}
