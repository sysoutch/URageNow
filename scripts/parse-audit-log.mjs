// One-off helper: parse a Playwright audit log (UTF-16 or UTF-8) into a compact,
// comparable summary. Usage: node scripts/parse-audit-log.mjs <path-to-log> [more logs]
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: node parse-audit-log.mjs <log>...");
  process.exit(1);
}

for (const file of files) {
  const raw = readFileSync(file).toString("utf8").replace(/^/, "");
  if (!raw.trim()) continue;
  // Tee-Object may write UTF-16LE; Node's toString('utf8') mangles it. Re-read bytes.
}

for (const file of files) {
  const buf = readFileSync(file);
  let text = "";
  if (buf[0] === 0xff && buf[1] === 0xfe) text = buf.toString("utf16le").replace(/^/, "");
  else if (buf[0] === 0x00 || (buf[0] === 0 && buf[2] === 0)) text = buf.toString("utf16le");
  else text = buf.toString("utf8").replace(/^/, "");

  const headerRe = /^=+ (\w+) \((\d+x\d+)\) =+\s*$/gm;
  const matches = [...text.matchAll(headerRe)];
  console.log(`# ${file}`);
  if (!matches.length) {
    console.log("  (no viewport headers found)");
    continue;
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i][0].indexOf("{") === -1 ? text.indexOf("{", matches[i].index + matches[i][0].length) : matches[i].index;
    const bodyStart = text.indexOf("{", matches[i].index);
    if (bodyStart === -1 || (i + 1 < matches.length && bodyStart > matches[i + 1].index)) {
      console.log(`  ${matches[i][1]}: no JSON block`);
      continue;
    }
    const end = i + 1 < matches.length ? text.indexOf("=====", bodyStart) : text.length;
    const chunk = text.slice(bodyStart, end === -1 ? undefined : end).trim();
    let m;
    try {
      // The block may contain trailing console noise after the JSON object.
      const decoded = JSON.parse(chunk);
      m = decoded;
    } catch (err) {
      console.log(`  ${matches[i][1]}: parse error (${err.message}); chunk head: ${chunk.slice(0, 200).replace(/\n/g, " ")}`);
      continue;
    }
    const e = m.elements || {};
    const pick = (sel) => {
      const el = e[sel];
      if (!el) return `${sel.split(".").pop().split("[")[0]}: missing`;
      if (!el.visible) return `${sel}: hidden(${el.display})`;
      return `${Math.round(el.x)},${Math.round(el.y)} ${Math.round(el.w)}x${Math.round(el.h)}`;
    };
    console.log(`\n=== ${matches[i][1]} (${matches[i][2]}) ===`);
    console.log(`  inner: ${m.innerWidth} overflowH:${m.horizontalOverflow ?? "?"} overflowV:${m.verticalOverflow ?? "?"} docScrollW:${m.docScrollWidth || "?"} docScrollH:${m.docScrollHeight ?? "?"} body: ${m.bodyClasses}`);
    for (const sel of [
      ".content-shell",
      '.view[data-view-panel="ai"]',
      "#ask-rod-card",
      "#ask-chat-tabs",
      ".ask-rod-main",
      "#ask-chat-feed",
      "#ask-chat-messages",
      ".ask-rod-composer",
      "#ask-prompt",
      "#ask-button",
      "#ask-voice-record-button",
      ".ask-composer-send-actions",
    ]) {
      console.log(`  ${sel.padEnd(34)} ${pick(sel)}`);
    }
    const sidebar = Object.keys(e).find((k) => k.includes("ask-rod-sidebar-panel"));
    if (sidebar) console.log(`  ask-rod-sidebar-panel            ${pick(sidebar)}`);
    const controls = m.sendControls || {};
    for (const [sel, v] of Object.entries(controls)) {
      console.log(`  send ${sel.padEnd(28)} ${v.visible ? "visible" : `hidden(${v.display})`} covered:${v.covered} hit:${v.centerTarget}`);
    }
    const scr = m.scrollers || [];
    console.log(`  scrollers(${scr.length}): ` + scr.map((c) => `${c.selector}[${(c.overflowY || "?").replace(/auto|scroll|hidden/g, (v) => v[0])}${c.canScrollY ? "*" : ""}]`).join(" | "));
    const ov = m.overlaps || [];
    console.log(`  overlaps(${ov.length}): ` + ov.slice(0, 6).map((o) => (typeof o === "string" ? o : `${o.a} <-> ${o.b}`)).join(" | ") + (ov.length > 6 ? ` ...(+${ov.length - 6})` : ""));
    const clipped = m.clippedChildren || [];
    console.log(`  clipped(${clipped.length}): ` + clipped.slice(0, 8).map((c) => `${c.child} in ${c.parent}`).join(" | ") + (clipped.length > 8 ? ` ...(+${clipped.length - 8})` : ""));
  }
}
