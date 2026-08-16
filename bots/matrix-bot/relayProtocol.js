"use strict";

function encodeRelayPayload(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeRelayPayload(value) {
  const text = Buffer.from(String(value || ""), "base64url").toString("utf8");
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Relay payload must be an object.");
  return parsed;
}

function parseRelayCommand(text) {
  const match = String(text || "").trim().match(/^!urage\s+([a-zA-Z0-9_-]{8,80})\s+(chat|image|image-interpret|image-improve|stt|audio|music|video|model3d)\s+([a-zA-Z0-9_-]+)$/);
  if (!match) return null;
  return {requestId: match[1], action: match[2], payload: decodeRelayPayload(match[3])};
}

function renderRelayResult(requestId, status, payload) {
  return `URAGE_RESULT ${requestId} ${status} ${encodeRelayPayload(payload)}`;
}

function renderRelayProgress(requestId, sequence, payload) {
  if (!Number.isInteger(sequence) || sequence < 0) throw new Error("Relay progress sequence must be a non-negative integer.");
  return `URAGE_PROGRESS ${requestId} ${sequence} ${encodeRelayPayload(payload)}`;
}

function renderRelayPrompt(requestId, prompt) {
  return `URAGE_PROMPT ${requestId} ${String(prompt || "").trim()}`;
}

module.exports = {decodeRelayPayload, encodeRelayPayload, parseRelayCommand, renderRelayProgress, renderRelayPrompt, renderRelayResult};
