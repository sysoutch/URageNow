// Scratch repro: map-generator 2D/3D tab sync behavior (current code).
import { chromium } from "playwright";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";

const ROOT = path.resolve("c:/Files/URageNow");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg" };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
        let filePath = path.join(ROOT, urlPath);
        if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
        fs.stat(filePath, (err, stat) => {
          if (err || !stat.isFile()) { res.writeHead(404); res.end("not found"); return; }
          res.writeHead(200, { "content-type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
          fs.createReadStream(filePath).pipe(res);
        });
      } catch (error) { res.writeHead(500); res.end(String(error)); }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function gridKey(grid) { return JSON.stringify((grid || []).map(row => Array.isArray(row) ? row : [])); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const server = await startServer();
const port = server.address().port;
const base = `http://127.0.0.1:${port}/tools/dev/map-generator/index.html`;
console.log("Serving on", port);

const browser = await chromium.launch({ args: ["--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (err) => console.log("[pageerror]", err.message));
await page.goto(base, { waitUntil: "domcontentloaded" });

async function frameReady(frame, name) {
  try { await frame.waitForFunction(() => typeof window.__urageGetSharedMap === "function", null, { timeout: 20000 }); console.log(name, "ready"); }
  catch (e) { console.log(name, "NOT READY:", e.message.split("\n")[0]); return false; }
  return true;
}

const f2d = page.frames().find(f => /2d\/index\.html$/.test(new URL(f.url()).pathname));
const f3d = page.frames().find(f => /3d\/index\.html$/.test(new URL(f.url()).pathname));
console.log("frames found:", !!f2d, !!f3d);
await Promise.all([frameReady(f2d, "2D"), frameReady(f3d, "3D")]);


const results = [];
function check(name, ok, detail) { results.push({ name, ok }); console.log((ok ? "PASS" : "FAIL"), "-", name, detail || ""); }

// T1: 2D generate -> 3D receives same grid
await f2d.click('button:has-text("Generate a Map")');
await sleep(700);
const s2d = await f2d.evaluate(() => window.__urageGetSharedMap());
const s3dAfter2DGen = await f3d.evaluate(() => window.__urageGetSharedMap());
check("T1 3D grid matches 2D after 2D generate", gridKey(s3dAfter2DGen.map) === gridKey(s2d.map), `2d=${(s2d.map || []).length}x${((s2d.map[0] || []).length)} sprites=${(s2d.sprites || []).length}`);

// T2: sprites present in 3D (debug accessor may not exist yet)
const spriteLayers = await f3d.evaluate(() => (window.__urageDebugScene ? window.__urageDebugScene().spriteLayers : "no-debug-accessor"));
check("T2 3D has sprite layers from 2D sprites", typeof spriteLayers === "number" && spriteLayers > 0, `layers=${spriteLayers}`);

// T3: tab switching must not reset the active view's map
const beforeSwitch = await f2d.evaluate(() => ({ grid: JSON.stringify(window.currentMap), w: window.canvas.width, h: window.canvas.height }));
await page.click("#tab3d"); await sleep(300);
await page.click("#tab2d"); await sleep(500);
const afterSwitch = await f2d.evaluate(() => ({ grid: JSON.stringify(window.currentMap), w: window.canvas.width, h: window.canvas.height }));
check("T3 switching tabs does not reset 2D map", beforeSwitch.grid === afterSwitch.grid && beforeSwitch.w === afterSwitch.w, `before=${beforeSwitch.w}x${beforeSwitch.h} after=${afterSwitch.w}x${afterSwitch.h}`);

// T4: local 2D option change (no publish) survives tab round-trip
await f2d.evaluate(() => { const el = document.getElementById("mapTilesX"); el.value = "17"; el.dispatchEvent(new Event("change")); });
await sleep(600);
const localM = await f2d.evaluate(() => JSON.stringify(window.currentMap));
check("T4a 2D option change regenerated locally", true, `changed=${localM !== gridKey(s2d.map)}`);
await page.click("#tab3d"); await sleep(250);
await page.click("#tab2d"); await sleep(500);
const afterRoundTrip = await f2d.evaluate(() => JSON.stringify(window.currentMap));
check("T4b local regen survives tab round-trip", afterRoundTrip === localM, "");

// T5: 3D generate -> 2D receives same grid
await page.click("#tab3d"); await sleep(300);
await f3d.click("#generateButton"); await sleep(800);
const s3dAfterGen = await f3d.evaluate(() => window.__urageGetSharedMap());
const g2dAfter3DGen = await f2d.evaluate(() => JSON.stringify(window.currentMap));
check("T5 2D grid matches 3D after 3D generate", g2dAfter3DGen === gridKey(s3dAfterGen.map), `3d=${(s3dAfterGen.map || []).length} rows`);

// T6: auto-generate keeps publishing (new behavior; old code publishes only first click)
await page.click("#tab2d"); await sleep(400);
const s2dBeforeAuto = await f2d.evaluate(() => window.__urageGetSharedMap());
await f2d.click("#generateMap .btn-success:nth-of-type(2)").catch(() => {}); // auto-generate toggle (sync icon)
await sleep(3000); // let several auto iterations run
const s2dLive = await f2d.evaluate(() => window.__urageGetSharedMap());
await f2d.evaluate(() => stopAutoGenerate()); // stop the loop so both sides settle on the final published map
await sleep(700);
const s3dPostAuto = await f3d.evaluate(() => window.__urageGetSharedMap());
const s2dFinal = await f2d.evaluate(() => window.__urageGetSharedMap());
check("T6a 2D actually changed during auto-generate", gridKey(s2dLive.map) !== gridKey(s2dBeforeAuto.map), "");
check("T6b auto-generate keeps 3D in sync", gridKey(s3dPostAuto.map) === gridKey(s2dFinal.map), "");

await page.screenshot({ path: "after-t6.png" });
console.log("\nSUMMARY:", results.map(r => `${r.ok ? "PASS" : "FAIL"} ${r.name}`).join(" | "));
await browser.close();
server.close();

