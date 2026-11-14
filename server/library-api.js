import express from "express";
import { z } from "zod";
import { deleteAttachment, listLibrary, storageInfo } from "./attachments.js";
import { requireUser } from "./auth.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";

// The Library (every file on the server) and Projects (chats grouped with their own instructions).
export const libraryApi = express.Router();

function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) throw new AppError(400, "Invalid input.");
  return result.data;
}

function ownProject(userId, rawId) {
  const id = Number(rawId);
  const row = Number.isInteger(id) && id > 0
    ? db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(id, userId)
    : undefined;
  if (!row) throw new AppError(404, "Project not found.");
  return row.id;
}

function projectRow(r) {
  return {
    id: r.id,
    name: r.name,
    instructions: r.instructions,
    createdAt: r.created_at,
    chats: Number(r.chats || 0),
  };
}

const PROJECT_SELECT = `
  SELECT p.id, p.name, p.instructions, p.created_at,
         (SELECT COUNT(*) FROM conversations c WHERE c.project_id = p.id) AS chats
  FROM projects p
`;

libraryApi.get("/library", requireUser, (req, res) => {
  res.json({ items: listLibrary(req.user.id), storage: storageInfo() });
});

libraryApi.delete("/library/:id", requireUser, (req, res) => {
  if (!deleteAttachment(req.user.id, Number(req.params.id))) throw new AppError(404, "That file does not exist.");
  res.json({ ok: true });
});

libraryApi.get("/projects", requireUser, (req, res) => {
  const rows = db.prepare(`${PROJECT_SELECT} WHERE p.user_id = ? ORDER BY p.id DESC`).all(req.user.id);
  res.json({ projects: rows.map(projectRow) });
});

libraryApi.post("/projects", requireUser, (req, res) => {
  const input = parse(z.object({
    name: z.string().trim().min(1).max(80),
    instructions: z.string().max(4000).optional(),
  }), req.body);
  const { lastInsertRowid } = db.prepare("INSERT INTO projects (user_id, name, instructions) VALUES (?, ?, ?)")
    .run(req.user.id, input.name, input.instructions?.trim() || "");
  const row = db.prepare(`${PROJECT_SELECT} WHERE p.id = ?`).get(Number(lastInsertRowid));
  res.status(201).json({ project: projectRow(row) });
});

libraryApi.patch("/projects/:id", requireUser, (req, res) => {
  const id = ownProject(req.user.id, req.params.id);
  const input = parse(z.object({
    name: z.string().trim().min(1).max(80).optional(),
    instructions: z.string().max(4000).optional(),
  }), req.body);
  if (input.name !== undefined) {
    db.prepare("UPDATE projects SET name = ?, updated_at = datetime('now') WHERE id = ?").run(input.name, id);
  }
  if (input.instructions !== undefined) {
    db.prepare("UPDATE projects SET instructions = ?, updated_at = datetime('now') WHERE id = ?")
      .run(input.instructions.trim(), id);
  }
  const row = db.prepare(`${PROJECT_SELECT} WHERE p.id = ?`).get(id);
  res.json({ project: projectRow(row) });
});

// Deleting a project keeps its chats; they go back to the normal list.
libraryApi.delete("/projects/:id", requireUser, (req, res) => {
  const id = ownProject(req.user.id, req.params.id);
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  res.json({ ok: true });
});
