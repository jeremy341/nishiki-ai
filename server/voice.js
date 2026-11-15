import { callModel, recordUsage } from "./ai.js";
import { answerConversation, titleFrom } from "./answer.js";
import { config } from "./config.js";
import { db } from "./db.js";
import { AppError } from "./errors.js";
import { memoryBlock } from "./memory.js";
import { assistantName, getFeatures, getPrefs } from "./prefs.js";
import { getVoiceEngine, resolveRole, roleConfigured } from "./providers.js";
import { learnFromChat } from "./recall.js";
import { localNow } from "./tools.js";
import { serverTtsConfigured, synthesizePcm } from "./tts.js";
import { transcribe } from "./transcribe.js";

// Fast voice mode. One call to the audio model does the listening and the answering: it takes the
// recording and streams back speech, so the first sound arrives after about a second instead of after
// three separate steps (recognise, think, speak). Small talk and general knowledge are answered right
// there. Anything that needs real data or an action (weather, calendar, reminders, notes, web search,
// memory) is handed to the full assistant through the ask_assistant tool, and its answer is read aloud
// sentence by sentence. The cheap speech-to-text model runs at the same time, only to write down what
// was said for the chat history; it is never waited for before the answer starts.
//
// Events sent to the page (emit):
//   { type: "audio", data }   base64 PCM16, 24 kHz, mono, always a whole number of samples
//   { type: "reply", text }   a piece of the spoken reply, for the screen
//   { type: "heard", text }   what the user said, from the transcription
//   { type: "handoff" }       the full assistant is working on it

const NO_SPEECH_TEXT = "(Sprachnachricht)";
const HISTORY_MESSAGES = 4; // the audio model charges six times what a text model does for what it reads
const HISTORY_CHARS = 300;

function interruptedVoiceError() {
  const error = new AppError(502, "The voice response was interrupted. Please try again.");
  error.voiceInterrupted = true;
  return error;
}

const ASK_ASSISTANT = {
  type: "function",
  function: {
    name: "ask_assistant",
    description: "Hands the request to the full assistant, which has the calendar, reminders, tasks, notes, mail, web search, weather, files, memory and charts. "
      + "Use it for everything except small talk, feelings and simple everyday questions. When in doubt, use it.",
    parameters: {
      type: "object",
      properties: {
        request: { type: "string", description: "What the user wants, as one clear, complete sentence in the user's language. Resolve words like \"that\" or \"tomorrow too\" from the conversation." },
      },
      required: ["request"],
      additionalProperties: false,
    },
  },
};

export function liveVoiceAvailable() {
  return config.voice.live && serverTtsConfigured() && roleConfigured("tts");
}

// The lane needs an audio-in model for the "stt" job (Voxtral Small by default) and a voice to speak with.
function laneAvailable() {
  return config.voice.live && serverTtsConfigured() && roleConfigured("stt");
}

function languageRule(prefs) {
  if (prefs.language === "de") return "Sprich immer Deutsch.";
  if (prefs.language === "en") return "Always speak English.";
  return prefs.uiLanguage === "en"
    ? "Speak the language the user speaks. If it is unclear, speak English."
    : "Sprich die Sprache, die der Mensch spricht. Wenn es unklar ist, sprich Deutsch. Wechsle nie von selbst ins Englische.";
}

function voiceSystem(userId, { writes = false } = {}) {
  const prefs = getPrefs(userId);
  const features = getFeatures(userId);
  const lines = [
    `Du bist ${assistantName()}, ein warmer, lockerer Sprachassistent und führst ein echtes Gespräch mit einem Menschen.`,
    writes
      ? "Schreibe so, wie man spricht: ruhig, natürlich, kurze Sätze, wie ein Freund. Deine Antwort wird vorgelesen. Antworte mit ein bis zwei Sätzen, nur auf Wunsch länger. Keine Listen, keine Emojis, keine Sonderzeichen."
      : "Sprich ruhig, natürlich und in kurzen Sätzen, wie ein Freund. Antworte mit ein bis zwei Sätzen, nur auf Wunsch länger. Keine Listen, keine Emojis.",
    languageRule(prefs),
    "Du antwortest NUR bei Smalltalk, Gefühlen und einfachen Alltagsfragen selbst. Bei allem anderen rufst du sofort ask_assistant auf und sagst davor nichts: Aktuelles, Wetter, Nachrichten, Termine, Pläne und Vorhaben (auch wenn der Mensch nur sagt, was er vorhat, etwa \"ich muss morgen zum Zahnarzt\"), Erinnerungen, Aufgaben, Notizen, Mails, Dateien, Zahlen und Vergleiche, Suchen und jede Aktion. Im Zweifel: ask_assistant. Erwähne nie Werkzeuge.",
  ];
  if (prefs.personality === "concise") lines.push("Fasse dich besonders kurz.");
  if (prefs.personality === "detailed") lines.push("Erkläre gern etwas genauer, aber bleib im Gesprächston.");
  if (prefs.customInstructions.trim()) lines.push(`Wünsche des Menschen: ${prefs.customInstructions.trim().slice(0, 500)}`);
  const memory = features.memory && prefs.memory ? memoryBlock(userId) : "";
  if (memory) lines.push(memory.slice(0, 600));
  lines.push(`Jetzt: ${localNow()}.`);
  return lines.join("\n");
}

function history(conversationId) {
  const rows = db.prepare(
    "SELECT role, content FROM messages WHERE conversation_id = ? AND role IN ('user', 'assistant') ORDER BY id DESC LIMIT ?",
  ).all(conversationId, HISTORY_MESSAGES).reverse();
  return rows
    .map((row) => ({ role: row.role, content: String(row.content || "").slice(0, HISTORY_CHARS) }))
    .filter((row) => row.content.trim());
}

// Base64 text arrives in pieces that do not line up with the data. This hands back only the part that
// is a whole number of 16-bit samples (a multiple of 8 characters) and keeps the rest for the next piece.
function pcmAligner() {
  let rest = "";
  return {
    push(piece) {
      rest += piece;
      const cut = Math.floor(rest.length / 8) * 8;
      if (!cut) return "";
      const ready = rest.slice(0, cut);
      rest = rest.slice(cut);
      return ready;
    },
    flush() {
      // A lone leftover byte cannot be a sample; drop it.
      const cut = Math.floor(rest.length / 4) * 4;
      const tail = rest.slice(0, cut);
      rest = "";
      const bytes = Buffer.from(tail, "base64");
      return bytes.length >= 2 ? bytes.subarray(0, bytes.length - (bytes.length % 2)).toString("base64") : "";
    },
  };
}

// The listening-and-answering call. Resolves with what the model said and whether it asked for the full assistant.
async function liveCall({ userId, conversationId, wav, voice, emit }) {
  const r = resolveRole("tts");
  const messages = [
    { role: "system", content: voiceSystem(userId) },
    ...history(conversationId),
    { role: "user", content: [{ type: "input_audio", input_audio: { data: wav, format: "wav" } }] },
  ];
  let response;
  try {
    response = await fetch(`${r.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${r.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: r.model,
        modalities: ["text", "audio"],
        audio: { voice: voice || r.voice || "alloy", format: "pcm16" },
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: config.voice.maxTokens,
        tools: [ASK_ASSISTANT],
        tool_choice: "auto",
        messages,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new AppError(502, "The voice service could not be reached.");
  }
  if (!response.ok || !response.body) {
    console.warn("Live voice provider returned HTTP", response.status);
    throw new AppError(502, "The voice service returned an error.");
  }

  const aligner = pcmAligner();
  const decoder = new TextDecoder();
  let buffer = "";
  let transcript = "";
  let usage = null;
  let audioChars = 0;
  const call = { name: "", args: "" };
  const tStart = Date.now();
  const sendAudio = (data) => {
    if (!data) return;
    if (!audioChars) debug("first audio after", Date.now() - tStart, "ms");
    audioChars += data.length;
    emit({ type: "audio", data });
  };
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
        let event;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }
        if (event.usage) usage = event.usage;
        const delta = event.choices?.[0]?.delta;
        if (!delta) continue;
        if (typeof delta.audio?.data === "string") sendAudio(aligner.push(delta.audio.data));
        if (typeof delta.audio?.transcript === "string" && delta.audio.transcript) {
          transcript += delta.audio.transcript;
          emit({ type: "reply", text: delta.audio.transcript });
        }
        for (const piece of delta.tool_calls || []) {
          if (piece.function?.name) call.name += piece.function.name;
          if (piece.function?.arguments) call.args += piece.function.arguments;
        }
      }
    }
  } catch (error) {
    // Do not persist or replay an incomplete answer once any reply text or audio was exposed.
    if (audioChars || transcript) {
      recordUsage(userId, "tts", "hackclub", r.model, usage);
      throw interruptedVoiceError();
    }
    throw error instanceof AppError ? error : new AppError(502, "The voice service stopped answering.");
  }
  sendAudio(aligner.flush());
  recordUsage(userId, "tts", "hackclub", r.model, usage);

  let request = "";
  if (call.name === "ask_assistant") {
    try {
      request = String(JSON.parse(call.args || "{}").request || "").trim();
    } catch {
      request = "";
    }
    return { handoff: true, request, transcript, spoke: audioChars > 0 };
  }
  if (!audioChars) {
    if (transcript) throw interruptedVoiceError();
    throw new AppError(502, "The voice service returned no audio.");
  }
  return { handoff: false, request: "", transcript, spoke: true };
}

// Lane: the model for the "stt" job (it takes audio and writes text) hears the recording and either answers
// in a sentence or two, which is spoken as it is written, or hands the request to the full assistant.
async function laneCall({ userId, conversationId, wav, voice, emit }) {
  const speaker = createSpeaker({ userId, voice, emit });
  const messages = [
    { role: "system", content: voiceSystem(userId, { writes: true }) },
    ...history(conversationId),
    { role: "user", content: [{ type: "input_audio", input_audio: { data: wav, format: "wav" } }] },
  ];
  let streamed = false;
  let message;
  try {
    message = await callModel(messages, {
      role: "stt", userId, tools: [ASK_ASSISTANT], maxTokens: config.voice.maxTokens, temperature: 0.6,
      onText: (text) => {
        streamed = true;
        speaker.feed(text);
        emit({ type: "reply", text });
      },
    });
  } catch (error) {
    const spoken = await speaker.stop();
    if (spoken || streamed) throw interruptedVoiceError();
    throw error;
  }
  const call = (message.tool_calls || []).find((c) => c.function?.name === "ask_assistant");
  if (call) {
    let request = "";
    try {
      request = String(JSON.parse(call.function.arguments || "{}").request || "").trim();
    } catch {
      request = "";
    }
    const spoke = (await speaker.finish().catch(() => 0)) > 0;
    return { handoff: true, request, transcript: "", spoke };
  }
  const text = String(message.content || "").trim();
  if (!text) throw new AppError(502, "The assistant had nothing to say.");
  let spoken = await speaker.finish().catch(() => 0);
  if (!spoken) {
    // The words did not stream (the provider sent them in one piece) or the voice refused them: say them now.
    const again = createSpeaker({ userId, voice, emit });
    if (!streamed) emit({ type: "reply", text });
    again.feed(text);
    spoken = await again.finish().catch(() => 0);
  }
  if (!spoken) throw new AppError(502, "The voice service could not read the answer.");
  return { handoff: false, request: "", transcript: text, spoke: true };
}

const debug = (...args) => { if (process.env.VOICE_DEBUG) console.log("[voice]", ...args); };

function emitPcm(emit, pcm) {
  const base64 = pcm.toString("base64");
  // 96,000 characters is a multiple of 8, so every slice is a whole number of samples.
  for (let at = 0; at < base64.length; at += 96_000) emit({ type: "audio", data: base64.slice(at, at + 96_000) });
}

const cleanForSpeech = (text) => String(text).replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim();

// Reads an answer aloud while it is still being written: each finished sentence goes to the voice at once,
// and the audio is sent in order. Nothing wrong is ever said (see tts.js); a sentence the voice refuses is left out.
function createSpeaker({ userId, voice, emit }) {
  const MAX_PIECES = 30;
  let pending = "";
  let count = 0;
  let spoken = 0;
  let stopped = false;
  let chain = Promise.resolve();

  function addPiece(piece) {
    const text = cleanForSpeech(piece);
    if (!text || count >= MAX_PIECES) return;
    count += 1;
    const made = synthesizePcm(text, voice, userId).catch(() => null);
    chain = chain.then(async () => {
      const pcm = await made;
      if (!pcm || stopped) return;
      spoken += 1;
      emitPcm(emit, pcm);
    });
  }

  function cut(final) {
    const boundary = /[.!?…]+(?=\s)|\n/g;
    let last = 0;
    let match;
    while ((match = boundary.exec(pending))) {
      const end = match.index + match[0].length;
      // The first sentence goes out as soon as it is a few words long, so sound starts early.
      if (pending.slice(last, end).trim().length >= (count === 0 ? 18 : 30)) {
        addPiece(pending.slice(last, end));
        last = end;
      }
    }
    pending = pending.slice(last);
    if (final && pending.trim()) {
      addPiece(pending);
      pending = "";
    }
  }

  return {
    feed(text) {
      pending += text;
      cut(false);
    },
    async finish() {
      cut(true);
      await chain;
      return spoken;
    },
    async stop() {
      stopped = true;
      return spoken;
    },
  };
}

// A short "one moment" played at once when the full assistant has to work. It is made once per voice and
// kept, so it costs nothing after the first time; until it exists, the handoff is just silent as before.
const fillerReady = new Map();
const fillerStarted = new Set();
function fillerFor(voice, prefs) {
  const english = prefs.language === "en" || (prefs.language !== "de" && prefs.uiLanguage === "en");
  const key = `${voice}:${english ? "en" : "de"}`;
  if (!fillerStarted.has(key)) {
    fillerStarted.add(key);
    synthesizePcm(english ? "One moment, let me check." : "Moment, ich schau kurz nach.", voice, null)
      .then((pcm) => fillerReady.set(key, pcm))
      .catch(() => fillerStarted.delete(key));
  }
  return fillerReady.get(key) || null;
}

// Called once after the server starts, so the first handoff already has its filler.
export function warmVoice() {
  if (!liveVoiceAvailable()) return;
  const voice = resolveRole("tts").voice || "alloy";
  const prefs = { language: "de", uiLanguage: "de" };
  // The voice sometimes refuses a phrase; try again a couple of times.
  for (const delay of [0, 8000, 20000]) {
    setTimeout(() => { try { fillerFor(voice, prefs); } catch { /* optional */ } }, delay).unref();
  }
}

function saveUserMessage(userId, conversationId, text) {
  const inserted = db.prepare("INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, 'user', ?)")
    .run(userId, conversationId, text);
  return Number(inserted.lastInsertRowid);
}

// The answer is the full assistant's: it reads the chat, may use tools, and writes the reply into the chat.
// Its words are spoken sentence by sentence as they appear.
async function handOff({ userId, conversationId, userText, voice, emit, spoke }) {
  const t0 = Date.now();
  emit({ type: "handoff" });
  if (!spoke) {
    const filler = fillerFor(voice, getPrefs(userId));
    if (filler) emitPcm(emit, filler);
  }
  const userMessageId = saveUserMessage(userId, conversationId, userText);
  const speaker = createSpeaker({ userId, voice, emit });
  let streamed = false;
  try {
    const { assistantId, actionIds } = await answerConversation({
      userId, conversationId, titleMessage: userText, userMessageId, voice: true,
      onText: (text) => {
        streamed = true;
        speaker.feed(text);
        emit({ type: "reply", text });
      },
    });
    debug("assistant finished after", Date.now() - t0, "ms");
    const reply = db.prepare("SELECT content FROM messages WHERE id = ?").get(assistantId)?.content || "";
    let spokenPieces = 0;
    try {
      spokenPieces = await speaker.finish();
      // Streaming did not deliver the words (the provider fell back to one piece): read the whole answer now.
      if (!streamed || !spokenPieces) {
        const again = createSpeaker({ userId, voice, emit });
        if (!streamed) emit({ type: "reply", text: reply });
        again.feed(reply);
        spokenPieces = await again.finish();
      }
    } catch (error) {
      console.warn("Voice could not read the answer:", error.message);
    }
    debug("spoken after", Date.now() - t0, "ms,", spokenPieces, "pieces");
    return { userMessageId, assistantId, actionIds };
  } catch (error) {
    db.prepare("DELETE FROM messages WHERE id = ?").run(userMessageId);
    throw error;
  }
}

// What was said and what was answered, written into the chat (the fast path has no tool step).
function saveExchange({ userId, conversationId, userText, replyText }) {
  const userMessageId = saveUserMessage(userId, conversationId, userText);
  const saved = db.prepare("INSERT INTO messages (user_id, conversation_id, role, content) VALUES (?, ?, 'assistant', ?)")
    .run(userId, conversationId, replyText || "…");
  db.prepare("UPDATE conversations SET updated_at = datetime('now'), title = COALESCE(title, ?) WHERE id = ?")
    .run(titleFrom(userText, []), conversationId);
  learnFromChat(userId, conversationId);
  return { userMessageId, assistantId: Number(saved.lastInsertRowid), actionIds: [] };
}

// One turn: the recording in, speech and the saved messages out.
export async function runVoiceTurn({ userId, conversationId, wav, emit }) {
  const voice = getPrefs(userId).voice;
  const t0 = Date.now();
  // Written down in parallel, only for the chat history.
  const heard = transcribe(wav, userId).catch(() => "").then((text) => {
    debug("heard after", Date.now() - t0, "ms");
    if (text) emit({ type: "heard", text });
    return text;
  });

  // The chosen engine first; if it fails before anything was said, the other one; then the slow way.
  let live = null;
  const engines = getVoiceEngine() === "lane" ? ["lane", "live"] : ["live", "lane"];
  for (const engine of engines) {
    if (live) break;
    if (engine === "live" ? !liveVoiceAvailable() : !laneAvailable()) continue;
    try {
      live = engine === "live"
        ? await liveCall({ userId, conversationId, wav, voice, emit })
        : await laneCall({ userId, conversationId, wav, voice, emit });
    } catch (error) {
      if (error.voiceInterrupted) throw error;
      console.warn(`Voice engine "${engine}" failed:`, error.message);
    }
  }

  debug("engine done after", Date.now() - t0, "ms, handoff:", Boolean(live?.handoff));
  if (live && !live.handoff) {
    const userText = (await heard) || NO_SPEECH_TEXT;
    return { ...saveExchange({ userId, conversationId, userText, replyText: live.transcript }), userText };
  }
  const userText = (await heard) || live?.request || "";
  if (!userText) throw new AppError(400, "Nothing was understood.");
  return { ...(await handOff({ userId, conversationId, userText, voice, emit, spoke: Boolean(live?.spoke) })), userText };
}
