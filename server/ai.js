import { config } from "./config.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";
import { resolveRole, roleConfigured } from "./providers.js";

export function aiConfigured() {
  return roleConfigured("chat");
}

// Some reasoning models wrap their thinking in <think> tags. Never show or speak that part.
function cleanModelText(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<\/?think>/gi, "").trim();
}

export function recordUsage(userId, role, provider, model, usage) {
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

// Anthropic models reuse the start of a prompt only when it is marked. The start (instructions, memory) is the
// same on every request, so it is marked; the clock line after it changes and is left out.
function withPromptCache(model, messages) {
  if (!model.startsWith("anthropic/")) return messages;
  let at = -1;
  messages.forEach((m, i) => {
    if (m.role === "system" && typeof m.content === "string" && !m.content.startsWith("Now:")) at = i;
  });
  if (at < 0) return messages;
  return messages.map((m, i) => (i === at
    ? { ...m, content: [{ type: "text", text: m.content, cache_control: { type: "ephemeral" } }] }
    : m));
}

// One model call for a job ("chat", "stt", "tts"). Returns the assistant message, which may
// contain tool_calls instead of text. Token counts are recorded against the user.
export async function callModel(messages, {
  role = "chat",
  userId,
  maxTokens = config.ai.maxTokens,
  temperature = 0.6,
  tools,
  budget, // { used } for one reply: tokens used so far, across its tool steps
  onText, // called with each piece of answer text as it arrives (switches to streaming)
  deep = false, // use the stronger model with thinking on (see route.js)
  onThinking, // called with each piece of the model's thinking as it arrives
} = {}) {
  const r = { ...resolveRole(role) };
  if (deep && config.ai.deepModel) r.model = config.ai.deepModel;
  else deep = false;
  const body = { model: r.model, messages: withPromptCache(r.model, messages), max_tokens: deep ? Math.max(maxTokens, config.ai.deepMaxTokens) : maxTokens, temperature };
  // Thinking is shown folded under the answer. The cheap model thinks at medium effort: without it, it sometimes answered
  // "I can look that up if you like" instead of using a tool. The stronger model thinks more.
  if (deep) body.reasoning = { effort: "medium" };
  else if (/deepseek/.test(r.model)) body.reasoning = { effort: "medium" };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = "auto";
  }
  if (onText) {
    try {
      const streamed = await streamChat(r, body, onText, onThinking);
      recordUsage(userId, role, r.providerId, r.model, streamed.usage);
      if (budget && streamed.usage) budget.used += Number(streamed.usage.total_tokens) || 0;
      return streamed.message;
    } catch (error) {
      // Nothing was shown yet: fall back to the normal call. After the first words, the error goes on.
      if (!(error instanceof AppError) || error.shown) throw error;
      if (error.status === 429) throw error;
    }
  }
  const data = await post(`${r.baseUrl}/chat/completions`, r.apiKey, body, 90_000);
  const message = data?.choices?.[0]?.message;
  if (!message) throw new AppError(502, "The AI returned an empty answer.");
  recordUsage(userId, role, r.providerId, r.model, data.usage);
  if (budget && data.usage) budget.used += Number(data.usage.total_tokens) || 0;
  if (typeof message.content === "string") message.content = cleanModelText(message.content);
  const thoughtText = message.reasoning || message.reasoning_content;
  if (onThinking && typeof thoughtText === "string" && thoughtText) onThinking(thoughtText);
  if (!message.content && !message.tool_calls?.length) {
    // Helps to find out why a model said nothing: how it ended and what it spent.
    console.warn("Empty answer from", r.model, "finish:", data.choices?.[0]?.finish_reason, "native:", data.choices?.[0]?.native_finish_reason, "usage:", JSON.stringify(data.usage || {}).slice(0, 200));
  }
  return message;
}

// Hides <think>…</think> blocks while text streams in, even when a tag is split between two pieces.
function thinkFilter(emit) {
  const OPEN = "<think>";
  const CLOSE = "</think>";
  let buffer = "";
  let inside = false;
  function drain(final) {
    for (;;) {
      if (inside) {
        const i = buffer.indexOf(CLOSE);
        if (i === -1) {
          buffer = final ? "" : buffer.slice(-(CLOSE.length - 1));
          return;
        }
        buffer = buffer.slice(i + CLOSE.length);
        inside = false;
        continue;
      }
      const i = buffer.indexOf(OPEN);
      if (i !== -1) {
        if (i > 0) emit(buffer.slice(0, i));
        buffer = buffer.slice(i + OPEN.length);
        inside = true;
        continue;
      }
      let hold = 0;
      if (!final) {
        for (let k = Math.min(OPEN.length - 1, buffer.length); k > 0; k -= 1) {
          if (OPEN.startsWith(buffer.slice(-k))) {
            hold = k;
            break;
          }
        }
      }
      if (buffer.length > hold) emit(buffer.slice(0, buffer.length - hold));
      buffer = final ? "" : buffer.slice(buffer.length - hold);
      return;
    }
  }
  return { push(text) { buffer += text; drain(false); }, end() { drain(true); } };
}

// One streamed model call. Text goes to onText as it arrives; the result has the same shape as the
// normal call: { message: { role, content, tool_calls? }, usage }.
async function streamChat(r, body, onText, onThinking) {
  let response;
  try {
    response = await fetch(`${r.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${r.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, stream: true, stream_options: { include_usage: true } }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new AppError(502, "The AI provider could not be reached. Try again in a moment.");
  }
  if (response.status === 429) throw new AppError(429, "The AI provider is rate-limiting right now. Wait a bit and try again.");
  if (!response.ok || !response.body) {
    console.warn("AI provider returned HTTP", response.status, "(stream)");
    throw new AppError(502, "The AI provider returned an error.");
  }

  let shown = false;
  const filter = thinkFilter((text) => {
    if (!text) return;
    shown = true;
    onText(text);
  });
  let content = "";
  let usage = null;
  const calls = [];
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let newline;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        let data;
        try {
          data = JSON.parse(payload);
        } catch {
          continue; // keep-alive or a partial frame
        }
        if (data.usage) usage = data.usage;
        const delta = data.choices?.[0]?.delta;
        if (!delta) continue;
        const thought = typeof delta.reasoning === "string" ? delta.reasoning : typeof delta.reasoning_content === "string" ? delta.reasoning_content : "";
        if (thought) onThinking?.(thought);
        if (typeof delta.content === "string" && delta.content) {
          content += delta.content;
          filter.push(delta.content);
        }
        for (const piece of delta.tool_calls || []) {
          const slot = calls[piece.index ?? 0] ||= { id: "", type: "function", function: { name: "", arguments: "" } };
          if (piece.id) slot.id = piece.id;
          if (piece.function?.name) slot.function.name += piece.function.name;
          if (piece.function?.arguments) slot.function.arguments += piece.function.arguments;
        }
      }
    }
  } catch (error) {
    const failure = error instanceof AppError ? error : new AppError(502, "The AI provider stopped answering. Try again in a moment.");
    failure.shown = shown;
    throw failure;
  }
  filter.end();
  const message = { role: "assistant", content: cleanModelText(content) };
  const finished = calls.filter((c) => c?.function?.name);
  if (finished.length) {
    message.tool_calls = finished.map((c, i) => ({ ...c, id: c.id || `call_${i}` }));
  }
  if (!message.content && !message.tool_calls) {
    const empty = new AppError(502, "The AI returned an empty answer.");
    empty.shown = shown;
    throw empty;
  }
  return { message, usage };
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
