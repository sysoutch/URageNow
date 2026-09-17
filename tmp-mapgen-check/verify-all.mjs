import fs from "node:fs";
const root = "c:/Files/URageNow/tools/dev/map-generator";
const read = (p) => fs.readFileSync(root + p, "utf8").replace(/\r/g, "");

// 1. 2D script load order
const htm2d = read("/2d/index.html");
console.log("== 2D script tags ==");
for (const m of [...htm2d.matchAll(/<script[^>]*src="([^"]+)"/g)]) console.log(m[1]);

// 2. 3D app.js bridge names
const app = read("/3d/js/app.js");
console.log("\n== 3D app.js markers ==");
for (const n of ["__urageGetSharedMap", "__urageApplySharedMap", "__urageDebugScene", "spriteToggleInput", "resetViewButton", "showSprites", "playerSprites", "dataUrl"]) console.log(n, app.includes(n));

// 3. 3D html controls
const htm3d = read("/3d/index.html");
console.log("\n== 3D html controls ==");
for (const n of ["spriteToggleInput", "resetViewButton"]) console.log(n, htm3d.includes(n));

// 4. renderer guard
const ren = read("/3d/js/renderer.js");
const i = ren.indexOf("showSprites !== false");
console.log("\n== renderer guard context ==");
console.log(ren.slice(Math.max(0, i - 120), i + 260));

// 5. css additions
for (const [p, marks] of [["/3d/css/styles.css", [".field-check {", "#resetViewButton {"]], ["/css/tab-bar.css", [".tab-btn:focus-visible"]]]) {
  const c = read(p);
  console.log("\n== " + p + " ==");
  for (const m of marks) console.log(m, c.includes(m));
}

// 6. tab-bar.js: no snapshot apply on activate
const tb = read("/js/tab-bar.js");
console.log("\n== tab-bar.js markers ==");
for (const n of ["function activateTab", "applySnapshotToView", "__urageApplySharedMap"]) console.log(n, tb.includes(n));
