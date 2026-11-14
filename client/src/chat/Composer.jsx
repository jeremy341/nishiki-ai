import { t } from "../i18n/index.js";
import { ArrowUp, AudioLines, Camera, Image as ImageIcon, Mic, Paperclip, Plus, Square, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { IconButton, Menu, MenuItem } from "../ui/ui.jsx";
import Thinking from "./Thinking.jsx";

const MAX_FILES = 4;
const BARS = 56;

// While recording: cancel (X) throws the recording away, the square stops and keeps the words in
// the box, the arrow stops and sends them straight away. Like the ChatGPT voice bar.
function RecordingBar({ levels, transcribing, onCancel, onStop, onSend }) {
  const padded = Array.from({ length: BARS }, (_, i) => levels[levels.length - BARS + i] ?? 0);
  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <IconButton label={t("Cancel recording")} onClick={onCancel} className="size-11 bg-raised">
        <X size={18} aria-hidden="true" />
      </IconButton>
      <div className="flex h-10 min-w-0 flex-1 items-center justify-center gap-[3px] overflow-hidden" aria-hidden="true">
        {transcribing ? (
          <span className="text-sm text-fg-subtle">{t("Transcribing…")}</span>
        ) : padded.map((level, i) => (
          <span
            key={i}
            className="w-[2px] shrink-0 rounded-[1px] bg-fg-muted transition-[height] duration-100"
            style={{ height: `${Math.max(2, Math.round(level * 34))}px`, opacity: i < BARS - levels.length ? 0.25 : 1 }}
          />
        ))}
      </div>
      <IconButton label={t("Stop and keep the text")} onClick={onStop} disabled={transcribing} className="size-11 bg-raised">
        <Square size={13} aria-hidden="true" fill="currentColor" />
      </IconButton>
      <IconButton
        label={t("Send recording")}
        onClick={onSend}
        disabled={transcribing}
        className="size-11 !bg-accent !text-accent-fg hover:opacity-85"
      >
        <ArrowUp size={18} aria-hidden="true" />
      </IconButton>
    </div>
  );
}

// The message box: one flat, bordered block, with the tools along its bottom edge.
// Enter sends on desktop; on phones Enter starts a new line and the send button is used.
export default function Composer({
  value, onChange, onSend, canSend, busy,
  files, onAttach, onRemoveFile,
  micState, onMic, onTalk,
  levels, onCancelRecording, onStopRecording, onSendRecording,
  calendarOn, useCalendar, onToggleCalendar,
  reasoning, onReasoning,
}) {
  const ref = useRef(null);
  const attachFull = files.length >= MAX_FILES;
  const voiceActive = micState === "recording" || micState === "transcribing";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function onKeyDown(event) {
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    if (desktop && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <form
      className="mx-auto w-full max-w-3xl"
      onSubmit={(event) => { event.preventDefault(); onSend(); }}
    >
      <div className="rounded-xl border border-border bg-surface transition-colors focus-within:border-fg-subtle">
        {voiceActive && (
          <RecordingBar
            levels={levels}
            transcribing={micState === "transcribing"}
            onCancel={onCancelRecording}
            onStop={onStopRecording}
            onSend={onSendRecording}
          />
        )}

        {!voiceActive && files.length > 0 && (
          <ul className="flex gap-2 overflow-x-auto px-2.5 pt-2.5" aria-label={t("Attached files")}>
            {files.map((f) => (
              <li
                key={f.localId}
                className={`relative flex w-40 shrink-0 items-center gap-2 rounded-md border bg-raised p-1.5 text-xs ${
                  f.status === "error" ? "border-danger/50" : "border-border"
                }`}
              >
                {f.previewUrl
                  ? <img src={f.previewUrl} alt="" className="size-9 rounded object-cover" />
                  : <span className="grid size-9 place-items-center rounded border border-border bg-surface"><FileText size={15} aria-hidden="true" /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{f.name}</span>
                  <span className={f.status === "error" ? "text-danger" : "text-fg-subtle"}>
                    {f.status === "uploading" ? t("Uploading…") : f.status === "error" ? (f.error || t("Failed")) : t("Ready")}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={t("Remove {name}", { name: f.name })}
                  onClick={() => onRemoveFile(f.localId)}
                  className="relative grid size-7 shrink-0 place-items-center rounded-md text-fg-subtle hover:bg-raised hover:text-fg after:absolute after:-inset-2 after:content-['']"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {!voiceActive && (
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("Ask anything")}
            rows={1}
            maxLength={4000}
            aria-label={t("Message")}
            className="block max-h-[200px] min-h-12 w-full resize-none border-0 bg-transparent px-3.5 pb-1 pt-3 text-base leading-6 placeholder:text-fg-subtle focus:outline-none md:text-[15px]"
          />
        )}

        {!voiceActive && (
          <div className="flex items-center gap-0.5 px-1.5 pb-1.5 md:gap-1">
            {/* Same choices as the iOS attach sheet: camera, photo library, Files. */}
            <Menu
              align="start"
              trigger={(
                <button
                  type="button"
                  aria-label={t("Add a photo or file")}
                  disabled={busy || attachFull}
                  className="grid size-11 place-items-center rounded-md text-fg-muted transition-colors hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-40 md:size-9"
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
              )}
            >
              <MenuItem icon={Camera} onSelect={() => onAttach("camera")}>{t("Take Photo")}</MenuItem>
              <MenuItem icon={ImageIcon} onSelect={() => onAttach("photos")}>{t("Photo Library")}</MenuItem>
              <MenuItem icon={Paperclip} onSelect={() => onAttach("files")}>{t("Choose Files")}</MenuItem>
            </Menu>
            {calendarOn && (
              <IconButton
                label={useCalendar ? t("Calendar is shared with the assistant") : t("Share my calendar with the assistant")}
                active={useCalendar}
                onClick={onToggleCalendar}
                aria-pressed={useCalendar}
                className="size-11 font-mono text-[12px] font-medium md:size-9"
              >
                {t("Cal")}
              </IconButton>
            )}
            <IconButton label={t("Dictate")} onClick={onMic} className="size-11 md:size-9">
              <Mic size={16} aria-hidden="true" />
            </IconButton>
            <Thinking value={reasoning} onChange={onReasoning} />
            <div className="ml-auto flex items-center gap-1">
              {!canSend && (
                <IconButton label={t("Conversation mode")} onClick={onTalk} className="size-11 md:size-9">
                  <AudioLines size={16} aria-hidden="true" />
                </IconButton>
              )}
              {canSend && (
                <IconButton
                  label={busy ? t("Sending") : t("Send")}
                  type="submit"
                  disabled={busy || !canSend}
                  className="size-11 !bg-accent !text-accent-fg hover:opacity-85 disabled:opacity-40 md:size-9"
                >
                  <ArrowUp size={16} aria-hidden="true" />
                </IconButton>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="mt-1.5 hidden justify-end px-1 font-mono text-[11px] text-fg-subtle md:flex">
        <span>{t("Enter to send · Shift+Enter for a new line")}</span>
      </div>
    </form>
  );
}
