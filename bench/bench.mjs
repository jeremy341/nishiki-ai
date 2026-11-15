// Benchmark: real questions through the app's agent loop. No chats or messages are stored (userId null = no usage rows).
// Usage: node --env-file=.env bench/bench.mjs [repeats]
const S = (f) => import(new URL(`../server/${f}`, import.meta.url).href);
const { runAgent } = await S("agent.js");
const { SYSTEM_PROMPT } = await S("answer.js");
const { localNow, toolSpecs } = await S("tools.js");
const { needsDeepThinking } = await S("route.js");
const { config } = await S("config.js");

const LIST = { // $ per token (public Hack Club list), used when the API reports no cost
  "anthropic/claude-haiku-5.5": [1e-7, 5e-7],
  "~deepseek/deepseek-flash-latest": [2e-8, 1.08e-7],
};
const SCENARIOS = [
  { name: "smalltalk", q: "Hallo, wie gehts dir heute?", expectTool: false },
  { name: "facts+search", q: "Warum ist die Nvidia-Aktie in den letzten Wochen gefallen?", expectTool: "web_search" },
  { name: "chart", q: "Vergleiche die Größe der Planeten in unserem Sonnensystem.", expectTool: "show_widget" },
  { name: "hard", q: "Analysiere die Vor- und Nachteile von SQLite gegenüber Postgres für eine kleine App mit fünf Nutzern.", expectTool: false },
];
const efforts = (process.env.EFFORTS || "none,low,medium").split(",");
const configs = [
  ...efforts.map((e) => ({ label: `deepseek/${e}`, model: "~deepseek/deepseek-flash-latest", effort: e })),
  { label: "haiku/default", model: "anthropic/claude-haiku-5.5", effort: null },
];
const repeats = Number(process.argv[2] || 2);

// Count every model call by wrapping fetch (and optionally rewriting the thinking level).
const realFetch = globalThis.fetch;
let calls = [];
let current = null;
globalThis.fetch = async (url, init) => {
  if (!String(url).endsWith("/chat/completions") || !current) return realFetch(url, init);
  const body = JSON.parse(init.body);
  body.model = current.model;
  if (current.effort) body.reasoning = { effort: current.effort }; else delete body.reasoning;
  const t = Date.now();
  const res = await realFetch(url, { ...init, body: JSON.stringify(body) });
  const json = await res.clone().json().catch(() => null);
  const u = json?.usage || {};
  calls.push({ ms: Date.now() - t, p: u.prompt_tokens || 0, c: u.completion_tokens || 0, r: u.completion_tokens_details?.reasoning_tokens || 0, cost: u.cost, tools: (json?.choices?.[0]?.message?.tool_calls || []).map((x) => x.function.name) });
  return res;
};

function makeCtx(deep) {
  return {
    userId: null, conversationId: null, googleConnected: false, attachmentIds: [], actionIds: [], sources: [],
    exaAvailable: true, mailReady: false, widgets: [], activity: [], voice: false, thinking: "", deep,
    onThinking: () => {}, allow: { web: true, memory: false, mail: false, calendar: false, gmail: false },
    connectorSpecs: [], connectorMap: new Map(), enabledApps: new Set(),
  };
}

const rows = [];
for (const sc of SCENARIOS) {
  for (const cfg of configs) {
    for (let i = 0; i < repeats; i++) {
      calls = []; current = cfg;
      const deep = needsDeepThinking(sc.q); // the real routing decision (hard questions use the stronger model)
      // For an apples-to-apples comparison the model is forced per config; "deep" only changes the thinking level there.
      const ctx = makeCtx(false);
      const messages = [
        { role: "system", content: SYSTEM_PROMPT("Nishiki") },
        { role: "system", content: "Answer in the language of the user's latest message. Never switch to English on your own." },
        { role: "system", content: `Now: ${localNow()}.` },
        { role: "user", content: sc.q },
      ];
      const t = Date.now();
      let answer = "", error = "";
      try { answer = await runAgent(messages, ctx); } catch (e) { error = e.message; }
      const secs = (Date.now() - t) / 1000;
      const [pi, po] = LIST[cfg.model];
      const prompt = calls.reduce((a, c) => a + c.p, 0), completion = calls.reduce((a, c) => a + c.c, 0);
      const reported = calls.every((c) => typeof c.cost === "number" && c.cost > 0) ? calls.reduce((a, c) => a + c.cost, 0) : null;
      const toolsUsed = [...new Set(calls.flatMap((c) => c.tools))];
      const ok = error ? "ERR" : sc.expectTool ? (toolsUsed.includes(sc.expectTool) ? "ok" : "MISSED TOOL") : (toolsUsed.length ? "tool?" : "ok");
      rows.push({ sc: sc.name, cfg: cfg.label, steps: calls.length, prompt, completion, reasoning: calls.reduce((a, c) => a + c.r, 0), list: prompt * pi + completion * po, reported, secs, ok, tools: toolsUsed.join("+"), words: answer.split(/\s+/).length, deep });
      process.stdout.write(`${sc.name} ${cfg.label} #${i + 1}: ${calls.length} steps ${secs.toFixed(1)}s ${ok}\n`);
    }
  }
}
// Summary: average per scenario and config
const key = (r) => `${r.sc}|${r.cfg}`;
const groups = new Map();
for (const r of rows) (groups.get(key(r)) || groups.set(key(r), []).get(key(r))).push(r);
const avg = (a, f) => a.reduce((s, r) => s + (f(r) ?? 0), 0) / a.length;
console.log("\nscenario       setup             steps  prompt  compl  think   list$      api$       secs  tools/ok");
for (const [k, g] of groups) {
  const [sc, cfg] = k.split("|");
  const rep = g.every((r) => r.reported != null) ? avg(g, (r) => r.reported).toFixed(5) : "   -   ";
  console.log(`${sc.padEnd(14)} ${cfg.padEnd(16)} ${avg(g, (r) => r.steps).toFixed(1).padStart(5)} ${Math.round(avg(g, (r) => r.prompt)).toString().padStart(7)} ${Math.round(avg(g, (r) => r.completion)).toString().padStart(6)} ${Math.round(avg(g, (r) => r.reasoning)).toString().padStart(6)}  ${avg(g, (r) => r.list).toFixed(5)}  ${rep}  ${avg(g, (r) => r.secs).toFixed(1).padStart(5)}  ${g[0].tools || "-"} / ${g.map((r) => r.ok).join(",")}`);
}
