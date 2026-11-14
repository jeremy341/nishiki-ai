// Renders a mockup page to a phone-sized PNG with headless Edge.
//   node docs/mockups/render.mjs home.html out/home.png [pond] [waitMs]
// The page is opened at 390x844 (iPhone), device pixel ratio 2. "pond" sets data-theme="pond" (dark) on <body>.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [page, out, theme = "paper", wait = "3500"] = process.argv.slice(2);
if (!page || !out) {
  console.log("usage: node render.mjs <page.html> <out.png> [paper|pond] [waitMs]");
  process.exit(1);
}
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "mock-"));
const port = 9700 + Math.floor(Math.random() * 200);
const proc = spawn(edge, ["--headless=new", "--disable-gpu", "--allow-file-access-from-files", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i += 1) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch { /* not up yet */ }
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0;
const pending = new Map();
const logs = [];
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  if (message.method === "Runtime.exceptionThrown") logs.push("EXC " + (message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text).slice(0, 200));
};
const send = (method, params = {}) => new Promise((resolve) => { id += 1; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: new URL(page, pathToFileURL(here + path.sep)).href });
await sleep(1500);
await send("Runtime.evaluate", { expression: `document.body.dataset.theme=${JSON.stringify(theme)}; document.documentElement.dataset.theme=${JSON.stringify(theme === "pond" ? "pond" : "paper")}; true` });
await sleep(Number(wait));
const shot = await send("Page.captureScreenshot", { format: "png" });
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(path.resolve(out), Buffer.from(shot.result.data, "base64"));
console.log("saved", out, logs.length ? "| " + logs.join(" | ") : "| no errors");
ws.close();
proc.kill();
