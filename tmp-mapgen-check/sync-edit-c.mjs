import fs from "node:fs";

const ROOT = "c:/Files/URageNow/tools/dev/map-generator";

function editFile(path, pairs) {
  const raw = fs.readFileSync(path, "latin1");
  const crlfCount = (raw.match(/\r\n/g) || []).length;
  const lfTotal = raw.split("\n").length - 1;
  const eol = crlfCount > Math.floor(lfTotal / 2) ? "\r\n" : "\n";
  let text = fs.readFileSync(path, "utf8");
  if (eol === "\n") text = text.replace(/\r\n/g, "\n"); // normalize stray CRLF
  for (const [oldLF, newLF, label] of pairs) {
    const oldText = oldLF.replace(/\r?\n/g, eol);
    const newText = newLF.replace(/\r?\n/g, eol);
    const count = text.split(oldText).length - 1;
    if (count !== 1) throw new Error(`${label}: expected exactly 1 match, found ${count}`);
    text = text.replace(oldText, newText);
    console.log("ok:", label);
  }
  fs.writeFileSync(path, text);
}

editFile(`${ROOT}/css/tab-bar.css`, [
  [
    `.tab-btn i {
  margin-right: 6px;
}`,
    `.tab-btn:focus-visible { outline: 2px solid rgba(143, 211, 106, 0.65); outline-offset: -2px; }

.tab-btn i {
  margin-right: 6px;
}`
  ]
]);

editFile(`${ROOT}/3d/index.html`, [
  [
    `        <p class="field-help">2D map sprites appear here as upright game-space sprites by default.</p>`,
    `        <p class="field-help">2D map sprites appear here as upright game-space sprites by default.</p>
        <label class="field-check">
          <input id="spriteToggleInput" type="checkbox" checked>
          <span>Show 2D sprites</span>
        </label>`
  ],
  [
    `          <input id="zoomInput" type="range" min="45" max="130" value="82">
        </label>
      </section>`,
    `          <input id="zoomInput" type="range" min="45" max="130" value="82">
        </label>
        <button id="resetViewButton" type="button">Reset View</button>
      </section>`
  ]
]);

editFile(`${ROOT}/3d/js/renderer.js`, [
  [
    `  (config.spriteLayers || []).forEach(layer => { const sprite = createSpriteBillboard(layer, config); if (sprite) root.add(sprite); });`,
    `  if (config.showSprites !== false && (config.spriteLayers || []).length) {
    (config.spriteLayers || []).forEach(layer => { const sprite = createSpriteBillboard(layer, config); if (sprite) root.add(sprite); });
  }`
  ]
]);

editFile(`${ROOT}/3d/css/styles.css`, [
  [
    `    min-height: 720px;
  }
}

.field-help { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.45; }`,
    `    min-height: 720px;
  }
}

.field-help { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.45; }

.field-check { display: flex; align-items: center; gap: 8px; min-height: 30px; color: var(--text); font-size: 13px; font-weight: 700; cursor: pointer; }
.field-check input[type="checkbox"] { width: 16px; height: 16px; accent-color: #8fd36a; cursor: pointer; }

#resetViewButton { margin-top: 2px; min-height: 30px; padding: 0 10px; border: 1px solid var(--line); border-radius: 8px; background: rgba(255, 255, 255, 0.06); color: var(--muted); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; }
#resetViewButton:hover { border-color: rgba(143, 211, 106, 0.45); color: #fff; background: rgba(143, 211, 106, 0.12); }`
  ]
]);

console.log("all small CRLF edits applied");
