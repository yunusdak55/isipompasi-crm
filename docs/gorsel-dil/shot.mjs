// Ekran goruntusu: node shot.mjs <klasor> [bekleme_ms]  (Chrome DevTools Protocol, ek paket yok)
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const dir = process.argv[2] ?? "yeni"; const wait = Number(process.argv[3] ?? 4500);
const extra = process.argv[4] ?? ""; // "lite" -> fx cerezi, "reduce" -> hareketi azalt
mkdirSync(dir, { recursive: true });
const CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9333 + Math.floor(Math.random() * 500);
const chrome = spawn(CH, ["--headless=new", `--remote-debugging-port=${port}`, "--hide-scrollbars", `--user-data-dir=${mkdtempSync(join(tmpdir(), "shot-"))}`, "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 40; i++) { try { const t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = t.find((x) => x.type === "page"); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pend = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable"); await send("Network.enable");
if (extra === "lite") await send("Network.setCookie", { name: "ik_fx", value: "lite", url: "http://localhost:3100" });
if (extra === "reduce") await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
const ONLY = process.env.ONLY; const shots0 = [["login", 1440, 900, "/login", false], ["panel", 1440, 1000, "/dev-onizleme", true], ["login-mobil", 375, 812, "/login", false], ["panel-mobil", 375, 812, "/dev-onizleme", true]];
const shots = ONLY ? shots0.filter((s) => s[0] === ONLY) : shots0;
for (const [name, w, h, path, full] of shots) {
  console.log("start", name, Date.now() % 100000);
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
  await send("Page.navigate", { url: `http://localhost:3100${path}` }); console.log("nav done");
  await sleep(wait);
  let clip;
  if (full) { const r = await send("Runtime.evaluate", { expression: "Math.max(document.querySelector('main')?.scrollHeight ?? 0, innerHeight) + 64", returnByValue: true }); const H = Math.min(r.result.value, 2600);
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: H, deviceScaleFactor: 1, mobile: w < 600 }); await sleep(900); }
  const { data } = await send("Page.captureScreenshot", { format: "png", ...(clip ? { clip } : {}) });
  writeFileSync(join(dir, `${name}${extra ? "-" + extra : ""}.png`), Buffer.from(data, "base64")); console.log("ok", name);
}
ws.close(); chrome.kill(); process.exit(0);
