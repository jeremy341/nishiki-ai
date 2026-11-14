import { useState } from "react";
import { toast } from "sonner";
import { api } from "../api.js";
import { t } from "../i18n/index.js";
import { Button, Field, Input, Modal, Select } from "../ui/ui.jsx";

const TEXTAREA = "w-full rounded-md border border-border bg-surface px-3 py-2 text-base md:text-sm "
  + "placeholder:text-fg-subtle focus:border-fg-subtle focus:outline-none focus:ring-2 focus:ring-fg/10";

// Create or edit a project: a name, and instructions every chat in it follows.
export function ProjectDialog({ project, onClose, onSaved }) {
  const [name, setName] = useState(project?.name || "");
  const [instructions, setInstructions] = useState(project?.instructions || "");
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const body = { name: name.trim(), instructions: instructions.trim() };
      const result = project
        ? await api(`/api/projects/${project.id}`, { method: "PATCH", body })
        : await api("/api/projects", { method: "POST", body });
      onSaved(result.project);
      toast.success(project ? t("Project saved") : t("Project created"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={project ? t("Edit project") : t("New project")}
      description={t("Chats in a project follow its instructions.")}
    >
      <form className="grid gap-4" onSubmit={save}>
        <Field label={t("Project name")}>
          <Input value={name} maxLength={80} required autoFocus onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("Instructions")} hint={t("For example: always answer in German, I am planning a trip to Spain.")}>
          <textarea
            className={`${TEXTAREA} min-h-28 resize-y`}
            maxLength={4000}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>{t("Cancel")}</Button>
          <Button variant="primary" type="submit" disabled={busy || !name.trim()}>{t("Save")}</Button>
        </div>
      </form>
    </Modal>
  );
}

// Moves a chat into a project, or out of all projects.
export function MoveDialog({ chat, projects, onClose, onMoved }) {
  const [projectId, setProjectId] = useState(chat.projectId ? String(chat.projectId) : "");
  const [busy, setBusy] = useState(false);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/api/conversations/${chat.id}`, {
        method: "PATCH",
        body: { projectId: projectId ? Number(projectId) : null },
      });
      onMoved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onOpenChange={(open) => { if (!open) onClose(); }} title={t("Move to project")}>
      <form className="grid gap-4" onSubmit={save}>
        <Field label={t("Project")}>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t("No project")}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>{t("Cancel")}</Button>
          <Button variant="primary" type="submit" disabled={busy}>{t("Save")}</Button>
        </div>
      </form>
    </Modal>
  );
}
