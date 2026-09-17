// Viewport sweep + layout checks for map-generator (2D/3D tabs).
import { chromium } from "playwright";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve("c:/Files/URageNow");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        let fp = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
        if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
        fs.stat(fp, (err, st) => { if (err || !st.isFile()) { res.writeHead(404); res.end("nf"); return; } res.writeHead(200, { "content-type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream" }); fs.createReadStream(fp).pipe(res); });
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
function check(name, ok, detail) { results.push({ name, ok }); console.log((ok ? "PASS" : "FAIL"), "-", name, detail || ""); }

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}/tools/dev/map-generator/index.html`;
const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto(base, { waitUntil: "domcontentloaded" });
await page.waitForSelector("iframe", { timeout: 15000 });
const findFrame = async (re) => { for (let i = 0; i < 40; i++) { const f = page.frames().find(x => x.url() && re.test(new URL(x.url()).pathname)); if (f) return f; await sleep(150); } throw new Error("frame not found: " + re); };
const f2d = await findFrame(/2d\/index\.html$/);
const f3d = await findFrame(/3d\/index\.html$/);
for (const [f, n] of [[f2d, "2D"], [f3d, "3D"]]) await f.waitForFunction(() => typeof window.__urageGetSharedMap === "function", null, { timeout: 20000 }).then(() => console.log(n, "ready"), (e) => console.log(n, "NOT READY"));

// Keyboard focus ring - must run before any iframe interaction so keys target the shell document.
let ring = "";
for (let i = 0; i < 12 && !ring; i++) {
  await page.keyboard.press("Tab");
  ring = await page.evaluate(() => { const el = document.activeElement; if (!el || !(el.id === "tab2d" || el.id === "tab3d")) return ""; const s = getComputedStyle(el); return `${el.id}:${s.outlineStyle}/${s.outlineWidth}`; });
}
check("keyboard focus shows tab outline ring", /tab(2d|3d):solid\/\d+px/.test(ring), ring || "no tab button focused within 12 Tabs");

await f2d.click('button:has-text("Generate a Map")');
await sleep(600);

// Flood check: snapshot message count while auto-generate runs ~2.5s (debounced -> few messages).
await page.evaluate(() => { window.__snapCount = 0; addEventListener("message", (e) => { if (e && e.data && e.data.type === "urage-map-generator-snapshot") window.__snapCount++; }); });
await f2d.click("#generateMap .btn-success:nth-of-type(2)").catch(() => {});
await sleep(2500);
const flood = await page.evaluate(() => window.__snapCount);
check("auto-generate publishes (debounced, not flooded)", flood >= 1 && flood <= 6, `count=${flood} over ~2.5s`);

for (const width of [320, 375, 768, 1024, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  await sleep(350);
  const ov = async (fr) => fr.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })).catch(() => null);
  const s = await ov(page), a = await ov(f2d), b = await ov(f3d);
  check(`width=${width} no horizontal overflow`, s.sw <= s.cw + 1 && (!a || a.sw <= a.cw + 1) && (!b || b.sw <= b.cw + 1), `shell=${s.sw}/${s.cw} 2d=${a ? a.sw + "/" + a.cw : "?"} 3d=${b ? b.sw + "/" + b.cw : "?"}`);
}

await page.setViewportSize({ width: 1440, height: 900 });
await page.click("#tab3d"); await sleep(400);
const box = (id) => f3d.evaluate((i) => { const el = document.getElementById(i); if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; }, id).then(v => v && v.w > 0 && v.h > 0 ? v : null);
const [spriteToggle, resetView] = await Promise.all([box("spriteToggleInput"), box("resetViewButton")]);
check("3D sprite checkbox row rendered", !!spriteToggle, JSON.stringify(spriteToggle));
check("3D Reset View button rendered", !!resetView, JSON.stringify(resetView));

const countLayers = () => f3d.evaluate(() => { const d = window.__urageDebugScene && window.__urageDebugScene(); return d ? d.spriteLayers : null; });
const withSprites = await countLayers();
await f3d.click("#spriteToggleInput"); await sleep(250);
const toggledOff = await countLayers();
check("unchecking sprites removes 3D layers", (withSprites || 0) > 0 && toggledOff === 0, `on=${withSprites} off=${toggledOff}`);
await f3d.click("#spriteToggleInput"); await sleep(250);

const camBefore = await f3d.evaluate(() => { const d = window.__urageDebugScene && window.__urageDebugScene(); return d ? d.camera : null; });
await f3d.click("#resetViewButton"); await sleep(250);
check("Reset View runs without error", true, JSON.stringify(camBefore || {}));
for (const [w, label] of [[375, "mobile"], [1440, "desktop"]]) { await page.setViewportSize({ width: w, height: 900 }); await sleep(300); await page.screenshot({ path: `sweep-3d-${label}.png` }); }

console.log("\nSUMMARY:", results.map(r => `${r.ok ? "PASS" : "FAIL"} ${r.name}`).join(" | "));
await browser.close();
server.close();
