import { t } from "./i18n/index.js";
import {
  AudioLines, ArrowUpRight, Calendar as CalendarIcon, Check, LogOut, Menu as MenuIcon, MoreHorizontal,
  Download, Pencil, PanelLeft, Plus, Settings as SettingsIcon, Sun, Moon, Trash2, Volume2, X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "./api.js";
import Sidebar from "./chat/Sidebar.jsx";
import { MoveDialog, ProjectDialog } from "./chat/ProjectDialog.jsx";
import Composer from "./chat/Composer.jsx";
import Message from "./chat/Message.jsx";
import { kindFor, MAX_BYTES, PICKER_ACCEPT, uploadFile } from "./files.js";
import KoiPanel from "./ui/KoiPanel.jsx";
import CommandPalette from "./ui/CommandPalette.jsx";
import { CalendarClock, FileText, Library as LibraryIcon, LayoutGrid, MessageSquare } from "lucide-react";
import { useStyle } from "./style.js";
import OrbView from "./OrbView.jsx";
import { canRecord, startRecording, transcribe } from "./recorder.js";
import { speak, stopSpeaking, unlockSpeech } from "./speech.js";
import { effectiveTheme, setThemePreference, toggleTheme } from "./theme.js";
import VoiceMode from "./VoiceMode.jsx";
import FileViewer from "./FileViewer.jsx";
import {
  Button, IconButton, Menu, MenuItem, MenuSeparator, Modal, Input,
} from "./ui/ui.jsx";

// Opened rarely, so loaded on first use.
const Settings = lazy(() => import("./Settings.jsx"));
const CalendarPanel = lazy(() => import("./Calendar.jsx"));
const Library = lazy(() => import("./Library.jsx"));
const Tasks = lazy(() => import("./Tasks.jsx"));

const MAX_FILES = 4;
// Used only when the suggestions cannot be loaded.
const STARTERS = [
  "Plan my week around a dentist visit on Tuesday",
  "Make a chart of my workouts this week",
  "Write a short packing list for a weekend trip",
  "Remember that I like green tea",
];

const readPref = (key, fallback) => {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === "1";
  } catch {
    return fallback;
  }
};
const writePref = (key, value) => {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* private mode: the preference just won't persist */
  }
};
const readActiveId = () => {
  try {
    const value = Number(window.localStorage.getItem("activeChat"));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
};
const writeActiveId = (id) => {
  try {
    if (id) window.localStorage.setItem("activeChat", String(id));
    else window.localStorage.removeItem("activeChat");
  } catch {
    /* ignore */
  }
};

// Small saved preferences for this browser. Private windows may refuse storage, so every access is guarded.
function readStored(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
function writeStored(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* not saved; the page still works */
  }
}

export default function Chat({ session, notice, clearNotice, refreshSession, onSignedOut }) {
  const { features, google, assistantName, user } = session;
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [actions, setActions] = useState([]); // proposals waiting for a tap
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]); // { localId, id, kind, name, mime, previewUrl, status, error }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [micState, setMicState] = useState("idle"); // idle | recording | transcribing
  const [speaking, setSpeaking] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(() => readPref("speakReplies", false));
  const [theme, setThemeState] = useState(() => effectiveTheme());
  const [useCalendar, setUseCalendar] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [renaming, setRenaming] = useState(null); // conversation being renamed
  const [renameText, setRenameText] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectEditing, setProjectEditing] = useState(null); // null, {} for a new project, or a project
  const [moving, setMoving] = useState(null); // chat being moved to a project
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Cmd/Ctrl+K opens the command palette.
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [settingsPage, setSettingsPage] = useState(null); // page Settings opens on, e.g. apps
  const [viewing, setViewing] = useState(null); // photo or PDF shown next to the chat
  // The sidebar can be hidden on wide screens, and the file viewer can be dragged wider or narrower.
  const [sidebarShown, setSidebarShown] = useState(() => readStored("sidebarShown", "1") !== "0");
  const [viewerWidth, setViewerWidth] = useState(() => Number(readStored("viewerWidth", "520")) || 520);
  useEffect(() => writeStored("sidebarShown", sidebarShown ? "1" : "0"), [sidebarShown]);
  useEffect(() => writeStored("viewerWidth", viewerWidth), [viewerWidth]);
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setSidebarShown((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [reasoning, setReasoning] = useState(() => session.prefs?.reasoning || "low");
  const [levels, setLevels] = useState([]); // live microphone levels for the recording bar
  const newChatProjectRef = useRef(null); // project for the next chat, when started inside one
  const micIntentRef = useRef("keep"); // what happens when a recording ends: keep, send or cancel // conversation to delete

  const recordingRef = useRef(null);
  const feedRef = useRef(null);
  // One hidden input per source, like the iOS attach menu: camera, photo library, Files.
  const cameraInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const activeRef = useRef(null); // the chat on screen; late replies for other chats must not show here
  const filesRef = useRef([]);
  filesRef.current = files;

  const calendarOn = Boolean(features.google && google?.connected && session.calendarApp);
  const active = conversations.find((c) => c.id === activeId);
  const uploading = files.some((f) => f.status === "uploading");
  const readyFiles = files.filter((f) => f.status === "ready");
  const canSend = !busy && !uploading && Boolean(input.trim() || readyFiles.length);
  const lastAnswerId = [...messages].reverse().find((m) => m.role === "assistant" && typeof m.id === "number")?.id;

  useEffect(() => {
    refreshProjects();
    api("/api/conversations")
      .then((data) => {
        setConversations(data.conversations);
        const stored = readActiveId();
        const chosen = data.conversations.find((c) => c.id === stored);
        if (chosen) return selectConversation(chosen.id);
        return null;
      })
      .catch((err) => handleError(err));
    return () => {
      stopSpeaking();
      recordingRef.current?.cancel();
      filesRef.current.forEach((f) => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    };
    // Runs once per visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (notice) {
      toast.success(notice);
      clearNotice();
    }
  }, [notice, clearNotice]);

  useEffect(() => {
    const feed = feedRef.current;
    if (feed) feed.scrollTo({ top: feed.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function handleError(err) {
    if (err.status === 401) {
      refreshSession();
      return;
    }
    setError(err.message);
  }

  async function refreshProjects() {
    try {
      const data = await api("/api/projects");
      setProjects(data.projects);
    } catch (err) {
      handleError(err);
    }
  }

  async function togglePin(chat) {
    try {
      await api(`/api/conversations/${chat.id}`, { method: "PATCH", body: { pinned: !chat.pinned } });
      refreshConversations();
    } catch (err) {
      handleError(err);
    }
  }

  async function deleteProject(project) {
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE", body: {} });
      toast.success(t("Project deleted"));
      refreshProjects();
      refreshConversations();
    } catch (err) {
      handleError(err);
    }
  }

  function startChatIn(project) {
    newChat();
    newChatProjectRef.current = project.id;
    setChatsOpen(false);
  }

  async function refreshConversations() {
    try {
      const data = await api("/api/conversations");
      setConversations(data.conversations);
    } catch (err) {
      handleError(err);
    }
  }

  async function loadMessages(id) {
    try {
      const data = await api(`/api/conversations/${id}/messages`);
      if (activeRef.current === id) {
        setMessages(data.messages);
        setActions(data.actions || []);
      }
    } catch (err) {
      if (err.status === 404) {
        newChat();
        refreshConversations();
        return;
      }
      handleError(err);
    }
  }

  function selectConversation(id) {
    stopSpeaking();
    setSpeaking(false);
    setError("");
    setActiveId(id);
    setActions([]);
    activeRef.current = id;
    writeActiveId(id);
    setMessages([]);
    setChatsOpen(false);
    return loadMessages(id);
  }

  function newChat() {
    newChatProjectRef.current = null;
    stopSpeaking();
    setSpeaking(false);
    setError("");
    setActiveId(null);
    setActions([]);
    activeRef.current = null;
    writeActiveId(null);
    setMessages([]);
    setChatsOpen(false);
  }

  // Edit a question, or generate the last answer again. The server answers again; the list is replaced.
  async function editMessage(id, content) {
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/messages/" + id, { method: "PATCH", body: { content } });
      setMessages(data.messages);
      setActions(data.actions || []);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  async function regenerateMessage(id) {
    setBusy(true);
    setError("");
    try {
      const data = await api("/api/messages/" + id + "/regenerate", { method: "POST", body: {} });
      setMessages(data.messages);
      setActions(data.actions || []);
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  }

  // The whole chat as a Markdown file, downloaded to the device.
  // Export as JSON: the chat's messages with their roles, times and file names.
  function exportJson() {
    if (!active) return;
    const data = {
      title: active.title || "",
      exportedAt: new Date().toISOString(),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content || "",
        createdAt: m.created_at,
        attachments: (m.attachments || []).map((a) => a.name),
      })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(active.title || "chat").replace(/[^\w -]+/g, "").trim().slice(0, 60) || "chat"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Export as PDF: the server builds the file, so it keeps the same look on every device.
  function exportPdf() {
    if (!active) return;
    const link = document.createElement("a");
    link.href = `/api/conversations/${active.id}/export.pdf`;
    link.click();
  }

  // Save an answer as a note.
  async function saveNote(message) {
    try {
      await api("/api/notes", { method: "POST", body: { text: message.content } });
      toast.success(t("Saved as a note"));
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Everything the command palette can do or open.
  const paletteCommands = [
    { id: "new", group: t("Actions"), label: t("New chat"), icon: Plus, run: newChat },
    { id: "library", group: t("Actions"), label: t("Library"), icon: LibraryIcon, run: () => setLibraryOpen(true) },
    { id: "tasks", group: t("Actions"), label: t("Scheduled tasks"), icon: CalendarClock, run: () => setTasksOpen(true) },
    { id: "apps", group: t("Actions"), label: t("Apps"), icon: LayoutGrid, run: () => { setSettingsPage("apps"); setSettingsOpen(true); } },
    { id: "settings", group: t("Actions"), label: t("Settings"), icon: SettingsIcon, run: () => setSettingsOpen(true) },
    { id: "sidebar", group: t("Actions"), label: sidebarShown ? t("Hide sidebar") : t("Show sidebar"), icon: PanelLeft, run: () => setSidebarShown((v) => !v) },
    { id: "theme", group: t("Actions"), label: t("Light or dark mode"), icon: Sun, run: changeTheme },
    ...(active ? [
      { id: "export-md", group: t("Export"), label: t("Export as Markdown"), icon: Download, run: exportChat },
      { id: "export-pdf", group: t("Export"), label: t("Export as PDF"), icon: FileText, run: exportPdf },
      { id: "export-json", group: t("Export"), label: t("Export as JSON"), icon: Download, run: exportJson },
    ] : []),
    ...conversations.map((c) => ({
      id: `chat-${c.id}`, group: t("Chats"), label: c.title || t("New chat"), icon: MessageSquare, run: () => selectConversation(c.id),
    })),
  ];

  function exportChat() {
    if (!active) return;
    const lines = [`# ${active.title || t("New chat")}`, ""];
    for (const m of messages) {
      lines.push(`## ${m.role === "user" ? t("You") : assistantName}`, "");
      if (m.content) lines.push(m.content, "");
      for (const a of m.attachments || []) lines.push(`_${t("Attached")}: ${a.name}_`, "");
    }
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(active.title || "chat").replace(/[^\w -]+/g, "").trim().slice(0, 60) || "chat"}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function saveRename(event) {
    event.preventDefault();
    const title = renameText.trim().slice(0, 120);
    if (!renaming || !title) return;
    try {
      await api(`/api/conversations/${renaming.id}`, { method: "PATCH", body: { title } });
      setRenaming(null);
      refreshConversations();
    } catch (err) {
      handleError(err);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api(`/api/conversations/${deleting.id}`, { method: "DELETE", body: {} });
      if (deleting.id === activeId) newChat();
      setDeleting(null);
      refreshConversations();
      toast.success(t("Chat deleted"));
    } catch (err) {
      handleError(err);
    }
  }

  // ---- attachments ----

  async function addFiles(fileList) {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    const room = MAX_FILES - files.length;
    if (room <= 0) {
      setError(`Attach at most ${MAX_FILES} files per message.`);
      return;
    }
    const items = picked.slice(0, room).map((file) => {
      const kind = kindFor(file);
      const tooBig = file.size > MAX_BYTES;
      return {
        localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        kind,
        mime: file.type,
        previewUrl: kind === "image" ? URL.createObjectURL(file) : null,
        status: tooBig ? "error" : "uploading",
        error: tooBig ? t("That file is too large (max 6 MB).") : "",
        file,
      };
    });
    setFiles((list) => [...list, ...items]);
    setError("");
    for (const item of items) {
      if (item.status === "error") continue;
      uploadFile(item.file)
        .then((attachment) => {
          setFiles((list) => list.map((f) => (f.localId === item.localId
            ? { ...f, id: attachment.id, kind: attachment.kind, name: attachment.name, status: "ready" }
            : f)));
        })
        .catch((err) => {
          setFiles((list) => list.map((f) => (f.localId === item.localId
            ? { ...f, status: "error", error: err.message }
            : f)));
        });
    }
  }

  function removeFile(localId) {
    setFiles((list) => {
      const gone = list.find((f) => f.localId === localId);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return list.filter((f) => f.localId !== localId);
    });
  }

  // ---- sending ----

  // Only real app states reach the orb.
  const status = micState === "recording" ? "listening"
    : busy ? "thinking"
    : speaking ? "speaking"
    : error ? "error"
    : "idle";

  function speakWith(text, callbacks) {
    return speak(text, { useServerVoice: features.serverTts, ...callbacks });
  }

  function speakReply(text) {
    speakWith(text, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: (code) => {
        setSpeaking(false);
        if (code === "not-supported") setError(t("This browser cannot read replies aloud."));
        else if (code !== "interrupted") setError(t("The reply could not be played."));
      },
    });
  }

  // Returns the reply text, or null if the message failed. Voice mode uses the return value.
  async function send(text, { voice = false, prompt } = {}) {
    const message = (prompt ?? text).trim();
    const ids = voice ? [] : readyFiles.map((f) => f.id);
    const sentFiles = voice ? [] : readyFiles;
    if ((!message && !ids.length) || busy || uploading) return null;
    unlockSpeech();
    stopSpeaking();
    setSpeaking(false);
    setError("");

    let conversationId = activeId;
    const pendingId = `pending-${Date.now()}`;
    setBusy(true);
    if (!voice) {
      setInput("");
      setFiles([]);
    }
    try {
      if (!conversationId) {
        const created = await api("/api/conversations", {
          method: "POST",
          body: { projectId: newChatProjectRef.current },
        });
        newChatProjectRef.current = null;
        conversationId = created.conversation.id;
        setConversations((list) => [created.conversation, ...list]);
        activeRef.current = conversationId;
        setActiveId(conversationId);
        writeActiveId(conversationId);
      }
      if (activeRef.current === conversationId) {
        setMessages((list) => [...list, {
          id: pendingId,
          role: "user",
          content: message,
          attachments: sentFiles.map((f) => ({ id: f.id, kind: f.kind, name: f.name, mime: f.mime, previewUrl: f.previewUrl })),
        }]);
      }

      const data = await api(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { message, attachmentIds: ids, useCalendar: calendarOn && useCalendar },
      });
      if (activeRef.current === conversationId) {
        setMessages((list) => [...list, data.message]);
        const proposed = data.actions || [];
        setActions((list) => [...list.filter((a) => !proposed.some((p) => p.id === a.id)), ...proposed]);
        if (speakReplies && !voice) speakReply(data.message.content);
      }
      refreshConversations();
      return data.message.content;
    } catch (err) {
      if (activeRef.current === conversationId) {
        setMessages((list) => list.filter((m) => m.id !== pendingId));
      }
      if (!voice) {
        // Give the text and files back so nothing has to be typed again.
        setInput(message);
        setFiles(sentFiles.map((f) => ({ ...f, status: "ready" })));
      }
      handleError(err);
      return null;
    } finally {
      setBusy(false);
    }
  }

  // Confirmation cards: the assistant proposed something, the user taps to run or drop it.
  async function confirmAction(action) {
    setError("");
    try {
      const data = await api(`/api/actions/${action.id}/confirm`, { method: "POST", body: {} });
      setActions((list) => list.filter((a) => a.id !== action.id));
      setMessages((list) => [...list, data.message]);
      toast.success(t("Done"));
    } catch (err) {
      if (err.status === 404 || err.status === 409) setActions((list) => list.filter((a) => a.id !== action.id));
      else setError(err.message);
    }
  }

  async function cancelAction(action) {
    setActions((list) => list.filter((a) => a.id !== action.id));
    await api(`/api/actions/${action.id}/cancel`, { method: "POST", body: {} }).catch(() => {});
  }

  // Dictation: records until you tap again, then the speech model turns it into text
  // that lands in the box, so you can check it before sending.
  // The microphone starts a recording. The recording bar then cancels (X), keeps the words in
  // the box (square) or sends them (arrow).
  async function toggleMic() {
    if (micState === "recording") return stopDictation("keep");
    if (micState !== "idle") return;
    unlockSpeech();
    stopSpeaking();
    setSpeaking(false);
    setError("");
    if (!canRecord) {
      setError(t("This browser cannot record audio. Type your message instead."));
      return;
    }
    setLevels([]);
    micIntentRef.current = "keep";
    const recording = startRecording({
      manual: true,
      maxMs: 120000,
      onLevel: (level) => setLevels((list) => [...list.slice(-119), level]),
    });
    recordingRef.current = recording;
    setMicState("recording");
    const { wav, error: micError } = await recording.done;
    recordingRef.current = null;
    const intent = micIntentRef.current;
    if (micError) {
      setMicState("idle");
      setError(micError === "not-allowed"
        ? t("Microphone access was blocked. Allow it in your browser settings.")
        : t("The microphone could not be used."));
      return;
    }
    if (!wav || intent === "cancel") {
      setMicState("idle");
      return;
    }
    setMicState("transcribing");
    try {
      const text = await transcribe(wav);
      if (intent === "send") {
        setMicState("idle");
        if (text.trim()) send(text);
        return;
      }
      if (text) setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    } catch (err) {
      handleError(err);
    } finally {
      setMicState("idle");
    }
  }

  // Ends the current recording: "keep" puts the words in the box, "send" sends them, "cancel" drops them.
  function stopDictation(intent) {
    micIntentRef.current = intent;
    if (intent === "cancel") recordingRef.current?.cancel();
    else recordingRef.current?.stop();
  }

  // The account keeps the choice too, so it follows the user to other devices.
  function saveAccountPref(patch) {
    api("/api/settings/prefs", { method: "PUT", body: patch }).catch(() => {});
  }

  // Apply the saved look and read-aloud choice once the account is loaded.
  useEffect(() => {
    if (!session.prefs) return;
    setThemePreference(session.prefs.theme);
    setThemeState(effectiveTheme());
    setSpeakReplies(session.prefs.readAloud);
    setReasoning(session.prefs.reasoning || "low");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.prefs?.theme, session.prefs?.readAloud, session.prefs?.reasoning]);

  function changeReasoning(level) {
    setReasoning(level);
    saveAccountPref({ reasoning: level });
  }

  function toggleSpeakReplies() {
    const next = !speakReplies;
    setSpeakReplies(next);
    writePref("speakReplies", next);
    saveAccountPref({ readAloud: next });
    if (!next) {
      stopSpeaking();
      setSpeaking(false);
    }
  }

  function changeTheme() {
    const next = toggleTheme();
    setThemeState(next);
    saveAccountPref({ theme: next });
  }

  function openVoice() {
    unlockSpeech();
    setVoiceOpen(true);
  }

  async function signOut() {
    stopSpeaking();
    recordingRef.current?.cancel();
    await api("/api/logout", { method: "POST", body: {} }).catch(() => {});
    writeActiveId(null);
    onSignedOut();
  }

  // Escape closes the chat list on phones.
  useEffect(() => {
    if (!chatsOpen) return undefined;
    const onKey = (event) => { if (event.key === "Escape") setChatsOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatsOpen]);

  // ---- layout ----

  const sidebar = (
    <Sidebar
      conversations={conversations}
      projects={projects}
      activeId={activeId}
      onSelect={selectConversation}
      onNewChat={newChat}
      onNewChatInProject={startChatIn}
      onRename={(c) => { setRenaming(c); setRenameText(c.title || ""); }}
      onDelete={(c) => setDeleting(c)}
      onTogglePin={togglePin}
      onMove={(c) => setMoving(c)}
      onNewProject={() => setProjectEditing({})}
      onEditProject={(p) => setProjectEditing(p)}
      onDeleteProject={deleteProject}
      onOpenLibrary={() => { setChatsOpen(false); setLibraryOpen(true); }}
      onOpenTasks={() => { setChatsOpen(false); setTasksOpen(true); }}
      onOpenApps={() => { setChatsOpen(false); setSettingsPage("apps"); setSettingsOpen(true); }}
    />
  );

  const sidebarHeader = (
    <div className="px-2 pb-3 pt-1 text-sm font-semibold tracking-tight">{assistantName}</div>
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Wide screens: the chat list is always visible */}
      <aside className={`hidden min-w-0 w-72 shrink-0 flex-col overflow-hidden border-r border-border bg-surface p-3 ${!sidebarShown ? "" : viewing ? "xl:flex" : "md:flex"}`} aria-label={t("Chats")}>
        {sidebarHeader}
        {sidebar}
      </aside>

      {/* Phones: the same list in a drawer */}
      {/* The chat list sits under the page and the page slides right over it, as in the ChatGPT iOS app. */}
      <aside
        aria-label={`${assistantName} chats`}
        {...(chatsOpen ? {} : { inert: "" })}
        className="fixed inset-y-0 left-0 z-0 flex w-[min(86vw,300px)] flex-col border-r border-border bg-surface pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] md:hidden"
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          {sidebarHeader}
          <IconButton label={t("Close chats")} onClick={() => setChatsOpen(false)}><X size={20} aria-hidden="true" /></IconButton>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">{sidebar}</div>
        <button
          type="button"
          onClick={() => { setChatsOpen(false); setSettingsOpen(true); }}
          className="m-3 flex items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-raised"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-raised text-xs font-medium uppercase">
            {(user?.username || "?").slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{user?.username}</span>
          <span className="text-xs text-fg-subtle">{t("Settings")}</span>
        </button>
      </aside>

      {chatsOpen && (
        <button
          type="button"
          aria-label={t("Close chats")}
          onClick={() => setChatsOpen(false)}
          className="fixed inset-y-0 right-0 z-20 md:hidden"
          style={{ left: "min(86vw, 300px)" }}
        />
      )}

      <main className={`relative z-10 flex min-w-0 flex-1 flex-col bg-canvas transition-[transform,border-radius] duration-300 ease-out md:transform-none md:rounded-none ${
        chatsOpen ? "origin-left translate-x-[min(86vw,300px)] scale-[0.92] overflow-hidden rounded-[22px] shadow-2xl" : ""
      }`}>
        <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-2 pt-[env(safe-area-inset-top)] md:px-4">
          <IconButton
            label={sidebarShown ? t("Hide sidebar") : t("Show sidebar")}
            onClick={() => setSidebarShown((v) => !v)}
            aria-expanded={sidebarShown}
            className="size-11 max-md:hidden"
          >
            <PanelLeft size={18} aria-hidden="true" />
          </IconButton>
          <IconButton label={t("Chats")} className="size-11 !rounded-full bg-raised md:hidden" onClick={() => setChatsOpen(true)}>
            <MenuIcon size={20} aria-hidden="true" />
          </IconButton>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 md:justify-start">
            <h1 className="truncate text-center text-[15px] font-medium md:text-left">{active?.title || (activeId ? t("Chat") : t("New chat"))}</h1>
            {active && (
              <Menu trigger={
                <button type="button" aria-label={t("Chat options")} className="grid size-11 shrink-0 place-items-center rounded-full text-fg-muted hover:bg-raised hover:text-fg">
                  <MoreHorizontal size={18} aria-hidden="true" />
                </button>
              } align="start">
                <MenuItem icon={Pencil} onSelect={() => { setRenaming(active); setRenameText(active.title || ""); }}>{t("Rename")}</MenuItem>
                <MenuItem icon={Download} onSelect={exportChat}>{t("Export as Markdown")}</MenuItem>
                <MenuItem icon={FileText} onSelect={exportPdf}>{t("Export as PDF")}</MenuItem>
                <MenuItem icon={Download} onSelect={exportJson}>{t("Export as JSON")}</MenuItem>
                <MenuItem icon={Trash2} destructive onSelect={() => setDeleting(active)}>{t("Delete")}</MenuItem>
              </Menu>
            )}
          </div>
          {status !== "idle" && (
            <span className="mr-1 hidden sm:block" aria-hidden="true">
              <OrbView status={status} size={26} decorative />
            </span>
          )}
          <Menu trigger={
            <button type="button" aria-label={`Account: ${user?.username || ""}`}
              className="grid size-7 place-items-center rounded-full bg-raised text-xs font-medium uppercase hover:bg-border">
              {(user?.username || "?").slice(0, 1)}
            </button>
          }>
            <div className="px-3 py-2 text-xs text-fg-subtle">Signed in as {user?.username}</div>
            <MenuSeparator />
            <MenuItem icon={theme === "dark" ? Sun : Moon} onSelect={changeTheme}>
              {theme === "dark" ? t("Light mode") : t("Dark mode")}
            </MenuItem>
            <MenuItem icon={Volume2} checked={speakReplies} onSelect={toggleSpeakReplies}>{t("Read replies aloud")}</MenuItem>
            {features.google && (
              <MenuItem icon={CalendarIcon} onSelect={() => setCalendarOpen(true)}>{t("Calendar")}</MenuItem>
            )}
            <MenuItem icon={SettingsIcon} onSelect={() => setSettingsOpen(true)}>{t("Settings")}</MenuItem>
            <MenuSeparator />
            <MenuItem icon={LogOut} destructive onSelect={signOut}>{t("Sign out")}</MenuItem>
          </Menu>
        </header>

        <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto" role="log" aria-label={t("Conversation")} aria-live="polite">
          {messages.length === 0 && !busy ? (
            <EmptyState
              assistantName={assistantName}
              activeId={activeId}
              onStarter={(text) => { setInput(text); document.querySelector("textarea[aria-label='Message']")?.focus(); }}
            />
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-7 px-4 py-6 md:px-6">
              {messages.map((m) => (
                <Message
                  key={m.id}
                  message={m}
                  onOpenFile={setViewing}
                  onEdit={editMessage}
                  onSaveNote={saveNote}
                  onRegenerate={regenerateMessage}
                  canRegenerate={m.id === lastAnswerId}
                  busy={busy}
                />
              ))}
              {busy && (
                <div className="flex items-center gap-3 text-fg-muted" aria-label={t("Thinking")}>
                  <OrbView status="thinking" size={24} decorative />
                  <span className="text-sm">{t("Thinking…")}</span>
                </div>
              )}
              {actions.length > 0 && (
                <div className="grid gap-3" aria-label={t("Waiting for your confirmation")}>
                  {actions.map((a) => (
                    <ActionCard key={a.id} action={a} onConfirm={() => confirmAction(a)} onCancel={() => cancelAction(a)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mx-auto mb-2 w-[min(92%,48rem)] rounded-xl bg-danger-soft px-4 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="shrink-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 md:px-6">
          <Composer
            value={input}
            onChange={setInput}
            onSend={() => send(input)}
            canSend={canSend}
            busy={busy}
            files={files}
            onAttach={(kind) => ({ camera: cameraInputRef, photos: photoInputRef, files: documentInputRef })[kind]?.current?.click()}
            onRemoveFile={removeFile}
            micState={micState}
            onMic={toggleMic}
            levels={levels}
            onCancelRecording={() => stopDictation("cancel")}
            onStopRecording={() => stopDictation("keep")}
            onSendRecording={() => stopDictation("send")}
            reasoning={reasoning}
            onReasoning={changeReasoning}
            onTalk={openVoice}
            calendarOn={calendarOn}
            useCalendar={useCalendar}
            onToggleCalendar={() => setUseCalendar((v) => !v)}
            model={features.model}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
          <input
            ref={documentInputRef}
            type="file"
            accept={PICKER_ACCEPT}
            multiple
            hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
      </main>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={paletteCommands} />

      {viewing && (
        <FileViewer
          file={viewing}
          width={viewerWidth}
          onResize={setViewerWidth}
          reserved={sidebarShown ? 288 : 0}
          onSummarized={(id) => { setViewing(null); selectConversation(id); }}
          onClose={() => setViewing(null)}
          onConverted={(pdf) => {
            if (activeId) loadMessages(activeId);
            setViewing(pdf);
          }}
        />
      )}

      <Modal
        open={Boolean(renaming)}
        onOpenChange={(open) => { if (!open) setRenaming(null); }}
        title={t("Rename chat")}
        footer={<>
          <Button onClick={() => setRenaming(null)}>{t("Cancel")}</Button>
          <Button variant="primary" type="submit" form="rename-form">{t("Save")}</Button>
        </>}
      >
        <form id="rename-form" onSubmit={saveRename}>
          <Input value={renameText} onChange={(e) => setRenameText(e.target.value)} maxLength={120} aria-label={t("Chat name")} autoFocus />
        </form>
      </Modal>

      <Modal
        open={Boolean(deleting)}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title={t("Delete this chat?")}
        description={t("“{title}” and all its messages and photos will be removed. This cannot be undone.", { title: deleting?.title || t("New chat") })}
        footer={<>
          <Button onClick={() => setDeleting(null)}>{t("Cancel")}</Button>
          <Button variant="danger" onClick={confirmDelete}><Trash2 size={16} aria-hidden="true" /> {t("Delete")}</Button>
        </>}
      />

      {settingsOpen && (
        <Suspense fallback={null}>
          <Settings
            open
            onOpenChange={setSettingsOpen}
            isAdmin={Boolean(user?.isAdmin)}
            username={user?.username}
            onSignOut={signOut}
            onAccountChanged={refreshSession}
            onChatsChanged={refreshConversations}
            initialPage={settingsPage}
          />
        </Suspense>
      )}

      {tasksOpen && (
        <Suspense fallback={null}>
          <Tasks
            onClose={() => setTasksOpen(false)}
            onOpenChat={(id) => { setTasksOpen(false); selectConversation(id); }}
          />
        </Suspense>
      )}

      {libraryOpen && (
        <Suspense fallback={null}>
          <Library
            onClose={() => setLibraryOpen(false)}
            onOpenChat={(id) => { setLibraryOpen(false); selectConversation(id); }}
            onOpenFile={(file) => { setLibraryOpen(false); setViewing(file); }}
          />
        </Suspense>
      )}

      {projectEditing && (
        <ProjectDialog
          project={projectEditing.id ? projectEditing : null}
          onClose={() => setProjectEditing(null)}
          onSaved={() => { setProjectEditing(null); refreshProjects(); }}
        />
      )}

      {moving && (
        <MoveDialog
          chat={moving}
          projects={projects}
          onClose={() => setMoving(null)}
          onMoved={() => { setMoving(null); refreshConversations(); }}
        />
      )}

      {calendarOpen && (
        <Suspense fallback={null}>
          <CalendarPanel open onOpenChange={setCalendarOpen} google={google} onChanged={refreshSession} />
        </Suspense>
      )}

      {voiceOpen && (
        <VoiceMode
          onClose={() => setVoiceOpen(false)}
          ask={(text) => send(text, { voice: true })}
          speak={(text, callbacks) => speakWith(text, callbacks)}
        />
      )}
    </div>
  );
}

const SOURCE_LABEL = { calendar: "From your calendar", memory: "From your memory", chat: "From your chats" };

// The home screen suggestions come from what the assistant knows (calendar, memory, chats).
function EmptyState({ assistantName, activeId, onStarter }) {
  const style = useStyle();
  const [items, setItems] = useState(null);
  useEffect(() => {
    let alive = true;
    api("/api/suggestions")
      .then((data) => { if (alive) setItems(data.items.map((item) => (item.fallback ? { ...item, text: t(item.text) } : item))); })
      .catch(() => { if (alive) setItems(STARTERS.map((text) => ({ text: t(text), source: "general" }))); });
    return () => { alive = false; };
  }, []);
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-7 px-6 py-10 text-center">
      {style === "koi"
        ? <KoiPanel className="h-44 w-full max-w-md" />
        : <OrbView status="idle" size={112} decorative />}
      <div className="grid gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          {activeId ? t("This chat is empty") : t("What can {name} do for you?", { name: assistantName })}
        </h2>
        <p className="text-[15px] text-fg-muted">{t("Type, dictate, attach a photo or PDF, or start a conversation.")}</p>
      </div>
      <div className="grid w-full gap-2 sm:grid-cols-2" aria-busy={!items}>
        {items
          ? items.map((item) => (
            <button
              key={item.text}
              type="button"
              onClick={() => onStarter(item.text)}
              className="rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm text-fg-muted transition-colors duration-150 hover:border-border-strong hover:text-fg"
            >
              {SOURCE_LABEL[item.source] && (
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
                  {t(SOURCE_LABEL[item.source])}
                </span>
              )}
              {item.text}
            </button>
          ))
          : Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[62px] animate-pulse rounded-lg border border-border bg-surface" />
          ))}
      </div>
    </div>
  );
}

// A proposal that changes data (calendar event, note deletion). Runs only on Confirm.
function ActionCard({ action, onConfirm, onCancel }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3.5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{action.title}</div>
        {action.details && <div className="mt-0.5 truncate text-sm text-fg-muted">{action.details}</div>}
      </div>
      <div className="flex gap-2">
        <Button variant="primary" size="sm" onClick={onConfirm}><Check size={16} aria-hidden="true" /> {t("Confirm")}</Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>{t("Cancel")}</Button>
      </div>
    </div>
  );
}
