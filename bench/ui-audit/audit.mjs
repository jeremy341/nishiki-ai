// Phone UI audit: opens every screen at several iPhone sizes in headless Edge and reports what breaks:
// sideways overflow, things cut off at the screen edge, tap targets that are too small, and form fields that make
// iPhones zoom in (font size under 16 px). Screenshots go to OUT.
//
//   BASE=http://127.0.0.1:8789 SID=<session id> node bench/ui-audit/audit.mjs
//   env: THEMES=light,dark  SIZES=320x568,390x844  ONLY=settings,tasks  OUT=dir
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.env.BASE || "http://127.0.0.1:8789";
const SID = process.env.SID || "";
const OUT = process.env.OUT || "bench/ui-audit/out";
const THEMES = (process.env.THEMES || "light").split(",");
const SIZES = (process.env.SIZES || "320x568,375x667,390x844,430x932").split(",").map((s) => s.split("x").map(Number));
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const EDGE = process.env.EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
fs.mkdirSync(OUT, { recursive: true });

const click = (selector) => `(()=>{const e=document.querySelector(${JSON.stringify(selector)}); if(!e) return 'missing ${selector.replace(/'/g, "")}'; e.click(); return 'clicked'})()`;
const clickText = (re, scope = "button") => `(()=>{const e=[...document.querySelectorAll(${JSON.stringify(scope)})].find(b=>/${re}/i.test((b.textContent||'')+' '+(b.getAttribute('aria-label')||''))); if(!e) return 'missing /${re}/'; e.click(); return 'clicked'})()`;

const CASES = [
  { name: "start", auth: false, path: "/" },
  { name: "login", auth: false, path: "/", steps: [clickText("anmelden|sign in")] },
  { name: "invite", auth: false, path: "/invite/demo-token" },
  { name: "home", path: "/" },
  { name: "chat-widgets", path: "/chat/7" },
  { name: "chat-sources", path: "/chat/9" },
  { name: "drawer", path: "/", steps: [click("header button[aria-label=Chats]")], skipMain: true },
  { name: "drawer-menu", path: "/", steps: [click("header button[aria-label=Chats]"), `(()=>{const b=document.querySelector('aside[aria-label$="chats"] ul li button'); const r=b.getBoundingClientRect(); b.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',bubbles:true,clientX:r.x+20,clientY:r.y+10})); return 'pressed'})()`], wait: 900, skipMain: true },
  { name: "settings", path: "/settings" },
  ...["account", "appearance", "personal", "voice", "apps", "memory", "mail", "usage", "data", "admin"].map((p) => ({ name: `settings-${p}`, path: `/settings/${p}` })),
  { name: "library", path: "/library" },
  { name: "tasks", path: "/tasks" },
  { name: "task-new", path: "/tasks", steps: [clickText("neue aufgabe|new task")] },
  { name: "calendar", path: "/calendar" },
  { name: "composer-focus", path: "/chat/7", steps: [`(()=>{const t=document.querySelector('textarea'); if(!t) return 'no textarea'; t.focus(); return 'focused'})()`] },
];

// Runs inside the page. Returns a JSON string.
const ANALYZER = `(() => {
  const W = innerWidth, H = innerHeight;
  const skipMain = %SKIPMAIN%;
  const inert = (e) => !!e.closest('[inert]');
  const visible = (e) => {
    const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
    if (inert(e)) return false;
    if (e.closest('.sr-only')) return false;
    if (skipMain && e.closest('main')) return false;
    return true;
  };
  const label = (e) => {
    const t = (e.getAttribute('aria-label') || e.textContent || e.placeholder || e.value || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
    return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (t ? ' "' + t + '"' : '');
  };
  // clipped by a scrolling/hidden ancestor that itself fits the screen = fine
  const clippedOk = (e) => {
    for (let p = e.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible') { const pr = p.getBoundingClientRect(); if (pr.right <= W + 1 && pr.left >= -1) return true; }
    }
    return false;
  };
  const out = { W, H, docW: document.documentElement.scrollWidth, overflowPage: document.documentElement.scrollWidth > W + 1, edge: [], small: [], zoom: [], fixedOver: [] };
  const all = [...document.querySelectorAll('body *')].filter((e) => !['SCRIPT','STYLE','CANVAS','PATH','SVG','G','CIRCLE','RECT','LINE','POLYLINE','POLYGON','DEFS','USE'].includes(e.tagName.toUpperCase()) && !(e instanceof SVGElement));
  for (const e of all) {
    if (!visible(e)) continue;
    const r = e.getBoundingClientRect();
    if ((r.right > W + 1 || r.left < -1) && !clippedOk(e)) {
      const cs = getComputedStyle(e);
      if (cs.position !== 'fixed' || r.width > W) out.edge.push(label(e) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
    }
  }
  const tap = document.querySelectorAll('button, a[href], [role=button], [role=tab], [role=menuitem], [role=switch], [role=checkbox], input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, summary');
  for (const e of tap) {
    if (!visible(e)) continue;
    const r = e.getBoundingClientRect();
    const inline = e.tagName === 'A' && getComputedStyle(e).display === 'inline';
    if (inline) continue;
    // behind a dialog or another page: cannot be tapped, so not a problem
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx >= 0 && cx < W && cy >= 0 && cy < H) { const top = document.elementFromPoint(cx, cy); if (!top || !(e.contains(top) || top.contains(e))) continue; }
    if (e.getAttribute('role') === 'switch' && r.height >= 28 && r.width >= 44) continue;
    // a field inside a bigger tappable box (the label or the message pill) is reached through that box
    if (/^(INPUT|TEXTAREA)$/.test(e.tagName)) { const box = e.closest('label') || e.parentElement; if (box && box.getBoundingClientRect().height >= 40) continue; }
    if (Math.min(r.width, r.height) < 40) out.small.push(label(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  for (const e of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select')) {
    if (!visible(e)) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    if (fs < 16) out.zoom.push(label(e) + ' ' + fs + 'px');
  }
  return JSON.stringify(out);
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "audit-"));
const port = 9500 + Math.floor(Math.random() * 400);
const edge = spawn(EDGE, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let browser;
for (let i = 0; i < 60 && !browser; i++) {
  await sleep(250);
  try { browser = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { /* not up yet */ }
}
if (!browser) { console.error("Edge did not start"); process.exit(1); }

async function runCase(c, [w, h], theme) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === "Runtime.exceptionThrown") errors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 160));
  };
  const send = (method, params = {}) => new Promise((res) => { id += 1; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  const auth = c.auth !== false;
  await send("Network.setCookie", { name: "sid", value: auth ? SID : "none", url: `${BASE}/`, path: "/", httpOnly: true, sameSite: "Lax" });
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setEmulatedMedia", { features: [{ name: "pointer", value: "coarse" }, { name: "any-pointer", value: "coarse" }, { name: "hover", value: "none" }, { name: "any-hover", value: "none" }] });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("theme", ${JSON.stringify(theme)})}catch(e){}` });
  await send("Page.navigate", { url: BASE + c.path });
  await sleep(2600);
  const stepLog = [];
  for (const s of c.steps || []) { stepLog.push(await evaluate(s)); await sleep(c.wait || 800); }
  await sleep(900);
  const res = JSON.parse(await evaluate(ANALYZER.replace("%SKIPMAIN%", c.skipMain ? "true" : "false")));
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const file = `${c.name}-${theme}-${w}x${h}.png`;
  fs.writeFileSync(path.join(OUT, file), Buffer.from(shot.result.data, "base64"));
  ws.close();
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  return { ...res, errors, stepLog, file };
}

const results = [];
for (const c of CASES) {
  if (ONLY.length && !ONLY.some((o) => c.name.startsWith(o))) continue;
  for (const theme of THEMES) {
    for (const size of SIZES) {
      let r;
      try { r = await runCase(c, size, theme); } catch (e) { r = { error: String(e).slice(0, 120), edge: [], small: [], zoom: [], errors: [], stepLog: [] }; }
      results.push({ name: c.name, theme, size: size.join("x"), ...r });
      const flags = [r.overflowPage ? "PAGE-OVERFLOW" : "", r.edge?.length ? `edge:${r.edge.length}` : "", r.small?.length ? `small:${r.small.length}` : "", r.zoom?.length ? `zoom:${r.zoom.length}` : "", r.errors?.length ? `js-errors:${r.errors.length}` : "", r.error ? "ERR " + r.error : "", ...(r.stepLog || []).filter((x) => /missing|no /.test(String(x))).map((x) => "step:" + x)].filter(Boolean);
      console.log(`${c.name.padEnd(16)} ${theme} ${size.join("x").padEnd(8)} ${flags.join(" ") || "ok"}`);
    }
  }
}
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));

// What is wrong, grouped, once per distinct message.
const groups = { edge: new Map(), small: new Map(), zoom: new Map() };
for (const r of results) for (const kind of ["edge", "small", "zoom"]) for (const msg of r[kind] || []) {
  const key = msg.replace(/\[[-0-9.]+\.\.[-0-9.]+\]/, "").replace(/ \d+x\d+$/, "").trim();
  const m = groups[kind]; if (!m.has(key)) m.set(key, new Set()); m.get(key).add(`${r.name}@${r.size}`);
}
for (const [kind, m] of Object.entries(groups)) {
  console.log(`\n== ${kind.toUpperCase()} (${m.size} distinct)`);
  for (const [key, where] of [...m].sort((a, b) => b[1].size - a[1].size).slice(0, 40)) console.log(`  ${key}   <- ${[...where].slice(0, 3).join(", ")}${where.size > 3 ? ` +${where.size - 3}` : ""}`);
}
edge.kill();
process.exit(0);
