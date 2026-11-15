// Contact sheet: several audit screenshots side by side in one image.
//   node bench/ui-audit/sheet.mjs out.png img1.png img2.png ...
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [out, ...imgs] = process.argv.slice(2);
const EDGE = process.env.EDGE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const cell = 300;
const url = (f) => `file:///${path.resolve(f).split(path.sep).join("/")}`;
const figures = imgs.map((f) => `<figure style="margin:0;color:#fff"><img src="${url(f)}" style="width:${cell}px;display:block"><figcaption>${path.basename(f, ".png")}</figcaption></figure>`).join("");
const html = `<body style="margin:0;background:#888;display:flex;gap:8px;padding:8px;font:12px sans-serif">${figures}</body>`;
const tmp = path.join(os.tmpdir(), `sheet-${Date.now()}.html`);
fs.writeFileSync(tmp, html);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "audit-sheet-"));
const width = imgs.length * (cell + 8) + 8;
const args = ["--headless=new", "--disable-gpu", "--allow-file-access-from-files", `--user-data-dir=${profile}`, `--window-size=${width},720`, `--screenshot=${path.resolve(out)}`, "--hide-scrollbars", "--virtual-time-budget=4000", url(tmp)];
const p = spawn(EDGE, args, { stdio: "ignore" });
await new Promise((r) => p.on("exit", r));
console.log("wrote", out, fs.existsSync(out) ? fs.statSync(out).size : "MISSING");
