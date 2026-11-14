import {
  CalendarClock, ChevronDown, ChevronRight, FolderInput, FolderPlus, LayoutGrid, Library, MoreHorizontal, Pencil,
  Pin, PinOff, Plus, Search, Trash2,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { api } from "../api.js";
import { currentLocale, t } from "../i18n/index.js";
import PondWindow from "../ui/PondWindow.jsx";
import WaveRule from "../ui/WaveRule.jsx";
import { IconButton, Menu, MenuItem, MenuSeparator } from "../ui/ui.jsx";

// The sidebar: search, the main places, pinned chats, projects, then recent chats by day, and the pond window below.
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
      className="pressable flex h-11 w-full items-center gap-2.5 rounded-md px-2 text-left font-mono text-[13px] font-medium text-fg-muted hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent md:h-9"
    >
      <Icon size={16} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div className="caption flex min-h-6 items-center justify-between px-2 pb-1">
      <span>{children}</span>
      {action}
    </div>
  );
}

function ChatRow({ chat, active, onSelect, onRename, onDelete, onTogglePin, onMove }) {
  const title = chat.title || t("New chat");
  return (
    <li className={`group relative flex items-center rounded-md transition-colors ${active ? "bg-raised" : "hover:bg-raised/50"}`}>
      {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />}
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect(chat.id)}
        className={`h-11 min-w-0 flex-1 overflow-hidden whitespace-nowrap fade-end rounded-md px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent md:h-9 ${
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
            className="mr-0.5 grid size-11 shrink-0 place-items-center rounded-md text-fg-subtle opacity-100 hover:text-fg md:size-9 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
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
          className="flex h-11 min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 text-left text-sm text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent md:h-9"
        >
          {open ? <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-fg-subtle" /> : <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-fg-subtle" />}
          <span className="truncate">{project.name}</span>
        </button>
        <Menu
          trigger={(
            <button
              type="button"
              aria-label={t("Options for {title}", { title: project.name })}
              className="mr-0.5 grid size-11 shrink-0 place-items-center rounded-md text-fg-subtle opacity-100 hover:text-fg md:size-9 md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
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
            <p className="caption px-2 py-1.5 normal-case">{t("No chats in this project yet.")}</p>
          )}
        </div>
      )}
    </div>
  );
}

// True from the md breakpoint up (the wide sidebar is shown), false on phones (the drawer).
function useWide() {
  const query = "(min-width: 768px)";
  const [wide, setWide] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : true));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia(query);
    const onChange = () => setWide(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return wide;
}

export default function Sidebar({
  conversations, projects, activeId,
  onSelect, onNewChat, onNewChatInProject, onRename, onDelete, onTogglePin, onMove,
  onNewProject, onEditProject, onDeleteProject, onOpenLibrary, onOpenTasks, onOpenApps,
  pondHeight = 0, drawer = false,
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
  // The pond window only runs where it can be seen: the wide sidebar on wide screens, the drawer on phones.
  const wide = useWide();
  const showPond = pondHeight > 0 && (drawer ? !wide : wide);
  const rowProps = { activeId, onSelect, onRename, onDelete, onTogglePin, onMove };
  const pinned = conversations.filter((c) => c.pinned);
  const recent = conversations.filter((c) => !c.pinned && !c.projectId);
  const groups = { today: [], yesterday: [], week: [], older: [] };
  for (const chat of recent) groups[dayGroup(chat.updated_at)].push(chat);

  const sections = [];
  if (pinned.length > 0) {
    sections.push((
      <section key="pinned">
        <SectionTitle>{t("Pinned")}</SectionTitle>
        <ChatList chats={pinned} {...rowProps} />
      </section>
    ));
  }
  sections.push((
    <section key="projects">
      <SectionTitle
        action={(
          <IconButton label={t("New project")} onClick={onNewProject} className="size-11 md:size-9">
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
        <p className="caption px-2 py-1.5 normal-case">
          {t("Projects group chats and give them shared instructions.")}
        </p>
      )}
    </section>
  ));
  for (const [key, chats] of Object.entries(groups)) {
    if (!chats.length) continue;
    sections.push((
      <section key={key}>
        <SectionTitle>{t(GROUP_LABEL[key])}</SectionTitle>
        <ChatList chats={chats} {...rowProps} />
      </section>
    ));
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <label className="mb-2 flex h-11 shrink-0 items-center gap-2 rounded-md border border-border px-2.5 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 md:h-9">
        <Search size={15} aria-hidden="true" className="shrink-0 text-fg-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search chats")}
          aria-label={t("Search chats")}
          className="min-w-0 flex-1 bg-transparent font-mono text-[13px] placeholder:text-fg-subtle focus:outline-none"
        />
      </label>
      {found === null && (
        <nav className="grid shrink-0 gap-px pb-2" aria-label={t("Chats")}>
          <NavItem icon={Plus} label={t("New chat")} onClick={() => onNewChat()} />
          <NavItem icon={Library} label={t("Library")} onClick={onOpenLibrary} />
          <NavItem icon={CalendarClock} label={t("Scheduled tasks")} onClick={onOpenTasks} />
          <NavItem icon={LayoutGrid} label={t("Apps")} onClick={onOpenApps} />
        </nav>
      )}

      {/* Only the chat list scrolls: the pond window and the account row below it stay where they are. */}
      <div className="quiet-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {found !== null && (
          <ul className="grid gap-px" aria-label={t("Search chats")}>
            {found.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => { setQuery(""); onSelect(r.id); }}
                  className="grid min-h-11 w-full gap-0.5 rounded-md px-3 py-1.5 text-left hover:bg-raised/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                >
                  <span className="truncate text-sm">{r.title || t("New chat")}</span>
                  {r.snippet && <span className="line-clamp-2 text-[13px] text-fg-muted">{r.snippet}</span>}
                  <span className="caption tabular-nums">{new Date(`${String(r.updatedAt).replace(" ", "T")}Z`).toLocaleDateString(currentLocale(), { day: "numeric", month: "short" })}</span>
                </button>
              </li>
            ))}
            {!found.length && <li className="caption px-2 py-2 normal-case">{t("No chats found.")}</li>}
          </ul>
        )}
        {found === null && (
          <>
            {sections.map((section, i) => (
              <Fragment key={section.key}>
                {i > 0 && <WaveRule className="my-3" />}
                {section}
              </Fragment>
            ))}
            {!conversations.length && <p className="caption px-2 py-2 normal-case">{t("Your chats will appear here.")}</p>}
          </>
        )}
      </div>

      {showPond && (
        <div className="shrink-0 pt-3 [@media(max-height:600px)]:hidden">
          <PondWindow height={pondHeight} />
        </div>
      )}
    </div>
  );
}
