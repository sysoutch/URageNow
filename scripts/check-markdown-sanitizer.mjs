import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const helperUrl = new URL("../dashboard/src/client/modules/dashboard/shared/presentationHelpers.js", import.meta.url);
const helperSource = await readFile(helperUrl, "utf8");
const createHelpers = new Function("window", `${helperSource}\nreturn createDashboardPresentationHelpers();`);
const hostileHtml = "<img src=x onerror=alert(1)>";
const marked = {parse: () => hostileHtml};

const missing = createHelpers({marked});
assert.equal(missing.renderMarkdownHtml(hostileHtml), "<p>&lt;img src=x onerror=alert(1)&gt;</p>");

const failing = createHelpers({marked, DOMPurify: {sanitize() { throw new Error("sanitizer unavailable"); }}});
assert.equal(failing.renderMarkdownHtml(hostileHtml), "<p>&lt;img src=x onerror=alert(1)&gt;</p>");

const sanitized = createHelpers({marked, DOMPurify: {sanitize: html => `<safe>${html}</safe>`}});
assert.equal(sanitized.renderMarkdownHtml(hostileHtml), `<safe>${hostileHtml}</safe>`);

console.log("Markdown sanitizer fail-closed checks passed.");
