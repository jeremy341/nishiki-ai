// Which questions go to the stronger model. Most messages are small talk, lookups and simple tool jobs, which the cheap
// model does well; only messages that look like real work (calculating, analysing, comparing, code, long texts) are sent
// to the stronger model with thinking switched on, because that costs several times more per answer.
const HARD = new RegExp([
  "analy[sz]", "vergleich", "compare", "beweis", "prove", "herleit", "derive", "berechne", "rechne", "calculate",
  "gleichung", "equation", "integral", "ableitung", "wahrscheinlichkeit", "probability", "algorithm", "optimier", "optimi[sz]e",
  "refactor", "debug", "stacktrace", "traceback", "schritt f(ü|ue)r schritt", "step by step", "pro und contra", "pros and cons",
  "strategie", "strategy", "abw(ä|ae)g", "trade-?off", "architektur", "architecture", "begr(ü|ue)nde", "ausf(ü|ue)hrlich", "in detail",
  "erkl(ä|ae)re mir.*(warum|wie genau)", "why does", "how exactly", "rätsel", "riddle", "logik", "logic",
].join("|"), "i");

export function needsDeepThinking(text) {
  const t = String(text || "");
  if (!t.trim()) return false;
  if (t.includes("```")) return true;
  if (t.length > 700) return true;
  return HARD.test(t);
}
