import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pageSource = await readFile(new URL("../dashboard/src/page.ts", import.meta.url), "utf8");
const aboutStart = pageSource.indexOf('id="about-overlay"');
const aboutEnd = pageSource.indexOf('id="runtime-overlay"', aboutStart);
assert.ok(aboutStart >= 0 && aboutEnd > aboutStart);
const aboutSource = pageSource.slice(aboutStart, aboutEnd);

assert.match(aboutSource, /renderBootstrapIcon\("chat-dots", "about-timeline-icon"\)/);
assert.match(aboutSource, /renderBootstrapIcon\("lightbulb"\)/);
assert.equal((aboutSource.match(/<svg viewBox="0 0 64 64"/g) || []).length, 5);
assert.equal((aboutSource.match(/<svg viewBox="0 0 (?:16|24) /g) || []).length, 0);
console.log("About overlay Bootstrap icon validation passed.");
