import assert from "node:assert/strict";
import {
  buildChatSoulPromptPrefix,
  extractChatSoulJson,
  normalizeChatSoulSettings,
  renderChatSoulMarkdown
} from "../dashboard/src/server/chatSkills/soulSettings.js";

const defaults = normalizeChatSoulSettings({});
assert.equal(defaults.activeReplyStyleId, "empty");
assert.equal(defaults.replyStyles.find(entry => entry.id === "empty")?.label, "<empty>");
assert.equal(defaults.replyStyles.find(entry => entry.id === "markdown")?.label, "Always Markdown");
assert.match(defaults.replyStyles.find(entry => entry.id === "html")?.prompt || "", /Do not include scripts/);

const custom = normalizeChatSoulSettings({
  activePersonalityId: "normal",
  activeReplyStyleId: "release-notes",
  replyStyles: [{
    id: "release-notes",
    label: "Release Notes",
    prompt: "Return headings for Added, Changed, and Fixed."
  }]
});
assert.equal(custom.activeReplyStyleId, "release-notes");
assert.equal(custom.replyStyles.find(entry => entry.id === "release-notes")?.prompt, "Return headings for Added, Changed, and Fixed.");

const emptyPrefix = buildChatSoulPromptPrefix(defaults, "");
assert.doesNotMatch(emptyPrefix, /active reply style/);
const markdownPrefix = buildChatSoulPromptPrefix(
  normalizeChatSoulSettings({activeReplyStyleId: "markdown"}),
  "# USER\n\nPrefers short examples."
);
assert.match(markdownPrefix, /\[SOUL\.md active reply style\]/);
assert.match(markdownPrefix, /GitHub-Flavored Markdown/);
assert.match(markdownPrefix, /\[USER\.md durable user notes\]/);
const jsonOverridePrefix = buildChatSoulPromptPrefix(
  normalizeChatSoulSettings({activeReplyStyleId: "markdown"}),
  "",
  "json"
);
assert.match(jsonOverridePrefix, /exactly one valid JSON value/);
assert.doesNotMatch(jsonOverridePrefix, /GitHub-Flavored Markdown/);
const invalidOverridePrefix = buildChatSoulPromptPrefix(
  normalizeChatSoulSettings({activeReplyStyleId: "markdown"}),
  "",
  "missing-style"
);
assert.match(invalidOverridePrefix, /GitHub-Flavored Markdown/);

const rendered = renderChatSoulMarkdown(custom);
assert.match(rendered, /Active Reply Style: Release Notes/);
assert.deepEqual(normalizeChatSoulSettings(extractChatSoulJson(rendered)), custom);

console.log("Chat reply style validation passed.");
