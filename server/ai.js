import { config } from "./config.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";
import { getPrefs } from "./prefs.js";
import { resolveRole, roleConfigured, supportsReasoning } from "./providers.js";

export function aiConfigured() {
  return roleConfigured("chat");
}

// Some reasoning models wrap their thinking in <think> tags. Never show or speak that part.
function cleanModelText(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<\/?think>/gi, "").trim();
}

function recordUsage(userId, role, provider, model, usage) {
  if (!userId || !usage) return;
  const prompt = Number(usage.prompt_tokens) || 0;
  const completion = Number(usage.completion_tokens) || 0;
  if (!prompt && !completion) return;
  db.prepare(`
    INSERT INTO usage (user_id, role, provider, model, prompt_tokens, completion_tokens)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, role, provider, model, prompt, completion);
}

async function post(url, apiKey, body, timeoutMs) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    console.warn("AI provider unreachable:", error.name);
    throw new AppError(502, "The AI provider could not be reached. Try again in a moment.");
  }
  if (response.status === 429) {
    throw new AppError(429, "The AI provider is rate-limiting right now. Wait a bit and try again.");
  }
  if (!response.ok) {
    // Log the status only; never the body or the key.
    console.warn("AI provider returned HTTP", response.status);
    throw new AppError(502, "The AI provider returned an error.");
  }
  return response.json().catch(() => null);
}

// One model call for a job ("chat", "stt", "tts"). Returns the assistant message, which may
// contain tool_calls instead of text. Token counts are recorded against the user.
export async function callModel(messages, {
  role = "chat",
  userId,
  maxTokens = config.ai.maxTokens,
  temperature = 0.6,
  tools,
} = {}) {
  const r = resolveRole(role);
  const body = { model: r.model, messages, max_tokens: maxTokens, temperature };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  // The user's thinking setting, for models that offer it (chat answers only).
  if (role === "chat" && userId && await supportsReasoning(r.model)) {
    body.reasoning = { effort: getPrefs(userId).reasoning };
  }
  const data = await post(`${r.baseUrl}/chat/completions`, r.apiKey, body, 90_000);
  const message = data?.choices?.[0]?.message;
  if (!message) throw new AppError(502, "The AI returned an empty answer.");
  recordUsage(userId, role, r.providerId, r.model, data.usage);
  if (typeof message.content === "string") message.content = cleanModelText(message.content);
  return message;
}

export async function chatCompletion(messages, options = {}) {
  const message = await callModel(messages, options);
  const text = typeof message.content === "string" ? message.content : "";
  if (!text) throw new AppError(502, "The AI returned an empty answer.");
  return text;
}

// Exa search and page reading, through the chat provider when it offers them.
export async function exa(path, body, userId) {
  const r = resolveRole("chat");
  if (!r.exa) throw new AppError(400, "Web search is not available with the current AI provider.");
  const data = await post(`${r.baseUrl}/exa/${path}`, r.apiKey, body, 30_000);
  return data || {};
}
