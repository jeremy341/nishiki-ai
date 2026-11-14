import { config } from "./config.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";
import { decryptSecret, encryptSecret } from "./security.js";

// Connectors: MCP servers over HTTP (the "Streamable HTTP" transport). The admin adds a
// server once; each user switches it on in Settings. Its tools are offered to the model.
// A tool that can change something (no readOnlyHint) only runs after the user taps Confirm.

const PROTOCOL = "2025-06-18";
const CLIENT = { name: "assistant", version: "1.0.0" };
const TOOLS_TTL_MS = 10 * 60 * 1000;
const MAX_TOOLS_PER_SERVER = 40;
const cache = new Map(); // serverId -> { session, tools, at }

export function listServers() {
  return db.prepare("SELECT id, name, url, token_enc IS NOT NULL AS has_token FROM mcp_servers ORDER BY id").all()
    .map((s) => ({ id: s.id, name: s.name, url: s.url, hasToken: Boolean(s.has_token) }));
}

export function addServer({ name, url, token }) {
  const cleanName = String(name || "").trim().slice(0, 60);
  if (!cleanName) throw new AppError(400, "Give the connector a name.");
  let parsed;
  try {
    parsed = new URL(String(url || "").trim());
  } catch {
    throw new AppError(400, "The connector needs a web address.");
  }
  const local = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    throw new AppError(400, "Connectors must use https.");
  }
  let tokenEnc = null;
  if (token && String(token).trim()) {
    if (!config.google.encryptionKey) throw new AppError(400, "Set ENCRYPTION_KEY on the server to store a connector token.");
    tokenEnc = encryptSecret(String(token).trim());
  }
  const { lastInsertRowid } = db.prepare("INSERT INTO mcp_servers (name, url, token_enc) VALUES (?, ?, ?)")
    .run(cleanName, parsed.toString(), tokenEnc);
  return Number(lastInsertRowid);
}

export function removeServer(id) {
  db.prepare("DELETE FROM mcp_servers WHERE id = ?").run(Number(id));
  cache.delete(Number(id));
}

export function userConnectors(userId) {
  return db.prepare(`
    SELECT s.id, s.name, COALESCE(u.enabled, 0) AS enabled
    FROM mcp_servers s LEFT JOIN user_mcp u ON u.server_id = s.id AND u.user_id = ?
    ORDER BY s.id
  `).all(userId).map((r) => ({ id: r.id, name: r.name, enabled: Boolean(r.enabled) }));
}

export function setUserConnector(userId, serverId, enabled) {
  const exists = db.prepare("SELECT id FROM mcp_servers WHERE id = ?").get(Number(serverId));
  if (!exists) throw new AppError(404, "No such connector.");
  db.prepare(`
    INSERT INTO user_mcp (user_id, server_id, enabled) VALUES (?, ?, ?)
    ON CONFLICT(user_id, server_id) DO UPDATE SET enabled = excluded.enabled
  `).run(userId, Number(serverId), enabled ? 1 : 0);
}

function serverRow(id) {
  return db.prepare("SELECT id, name, url, token_enc FROM mcp_servers WHERE id = ?").get(Number(id));
}

function parseReply(text, contentType, id) {
  if (contentType.includes("text/event-stream")) {
    for (const block of text.split(/\n\n+/)) {
      const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
      if (!data) continue;
      try {
        const msg = JSON.parse(data);
        if (msg.id === id) return msg;
      } catch {
        /* skip non-JSON events */
      }
    }
    return null;
  }
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed.find((m) => m.id === id) : parsed;
}

// Sends one JSON-RPC message. Returns the response for requests, nothing for notifications.
async function send(server, session, body, { expectReply }) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL,
  };
  if (server.token_enc) headers.Authorization = `Bearer ${decryptSecret(server.token_enc)}`;
  if (session.sessionId) headers["Mcp-Session-Id"] = session.sessionId;

  let response;
  try {
    response = await fetch(server.url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new AppError(502, `The connector "${server.name}" could not be reached.`);
  }
  const sid = response.headers.get("mcp-session-id");
  if (sid) session.sessionId = sid;
  if (!response.ok) {
    console.warn("Connector returned HTTP", response.status, server.name);
    throw new AppError(502, `The connector "${server.name}" returned an error.`);
  }
  if (!expectReply) return null;
  const text = await response.text();
  const reply = parseReply(text, response.headers.get("content-type") || "", body.id);
  if (!reply) throw new AppError(502, `The connector "${server.name}" sent no answer.`);
  if (reply.error) throw new AppError(502, `The connector "${server.name}" refused: ${String(reply.error.message || "error").slice(0, 120)}`);
  return reply.result;
}

let nextId = 1;
const rpcId = () => { nextId += 1; return nextId; };

async function connect(server) {
  const session = { sessionId: null };
  await send(server, session, {
    jsonrpc: "2.0", id: rpcId(), method: "initialize",
    params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: CLIENT },
  }, { expectReply: true });
  await send(server, session, { jsonrpc: "2.0", method: "notifications/initialized" }, { expectReply: false });
  return session;
}

// Tool list for one server, cached for a few minutes.
export async function serverTools(serverId) {
  const cached = cache.get(Number(serverId));
  if (cached && Date.now() - cached.at < TOOLS_TTL_MS) return cached.tools;
  const server = serverRow(serverId);
  if (!server) return [];
  const session = await connect(server);
  const tools = [];
  let cursor;
  do {
    const result = await send(server, session, {
      jsonrpc: "2.0", id: rpcId(), method: "tools/list", params: cursor ? { cursor } : {},
    }, { expectReply: true });
    tools.push(...(result.tools || []));
    cursor = result.nextCursor;
  } while (cursor && tools.length < MAX_TOOLS_PER_SERVER);
  const limited = tools.slice(0, MAX_TOOLS_PER_SERVER);
  cache.set(Number(serverId), { session, tools: limited, at: Date.now() });
  return limited;
}

export async function callTool(serverId, toolName, args) {
  const server = serverRow(serverId);
  if (!server) throw new AppError(404, "The connector is gone.");
  const cached = cache.get(Number(serverId));
  const session = cached?.session || await connect(server);
  const result = await send(server, session, {
    jsonrpc: "2.0", id: rpcId(), method: "tools/call", params: { name: toolName, arguments: args || {} },
  }, { expectReply: true });
  const text = (result.content || [])
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .slice(0, 20000);
  return { text: text || "(no text result)", isError: Boolean(result.isError) };
}

// Name the model sees for a connector's tool. Only letters, digits, - and _ (max 64).
export function toolName(serverId, tool) {
  return `mcp_${serverId}_${tool.replace(/[^A-Za-z0-9_-]/g, "_")}`.slice(0, 64);
}

// Specs for the chat, for every connector the user has switched on. A map from the
// model's name back to the connector and tool is returned as well.
// "create_note" -> "Create note", for cards the user reads.
function humanize(name) {
  const text = String(name || "").replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Action";
}

export async function connectorSpecs(userId) {
  const specs = [];
  const map = new Map();
  for (const connector of userConnectors(userId).filter((c) => c.enabled)) {
    let tools;
    try {
      tools = await serverTools(connector.id);
    } catch (error) {
      console.warn("Connector unavailable:", connector.name, error.name);
      continue;
    }
    for (const tool of tools) {
      const name = toolName(connector.id, tool.name);
      const schema = tool.inputSchema && typeof tool.inputSchema === "object"
        ? { ...tool.inputSchema, type: "object" }
        : { type: "object", properties: {} };
      specs.push({
        type: "function",
        function: {
          name,
          description: `[${connector.name}] ${String(tool.description || tool.name).slice(0, 500)}`,
          parameters: schema,
        },
      });
      map.set(name, {
        serverId: connector.id,
        tool: tool.name,
        readOnly: Boolean(tool.annotations?.readOnlyHint),
        serverName: connector.name,
        title: `${connector.name}: ${humanize(tool.title || tool.name)}`,
      });
    }
  }
  return { specs, map };
}
