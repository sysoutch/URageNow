"use strict";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const SOURCE_TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 64;

function safeFileName(value, fallbackExtension) {
  const cleaned = String(value || "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return cleaned || `matrix-source${fallbackExtension}`;
}

function detectImageContentType(data) {
  if (!Buffer.isBuffer(data)) return "";
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (data.length >= 6 && (data.toString("ascii", 0, 6) === "GIF87a" || data.toString("ascii", 0, 6) === "GIF89a")) return "image/gif";
  return "";
}

function detectAudioContentType(data) {
  if (!Buffer.isBuffer(data)) return "";
  if (data.length >= 12 && data.toString("ascii", 4, 8) === "ftyp") return "audio/mp4";
  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WAVE") return "audio/wav";
  if (data.length >= 4 && data.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (data.length >= 4 && data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) return "audio/webm";
  if (data.length >= 3 && data.toString("ascii", 0, 3) === "ID3") return "audio/mpeg";
  if (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return "audio/mpeg";
  return "";
}

class MatrixSourceRegistry {
  constructor(downloadSourceMedia, input) {
    this.downloadSourceMedia = downloadSourceMedia;
    this.marker = input.marker;
    this.messageTypes = new Set(input.messageTypes || [input.messageType]);
    this.kindLabel = input.kindLabel;
    this.detectContentType = input.detectContentType;
    this.fallbackExtension = input.fallbackExtension;
    this.toPayload = input.toPayload;
    this.now = input.now || (() => Date.now());
    this.entries = new Map();
  }

  remember(event) {
    this.prune();
    const match = String(event.body || "").trim().match(this.marker);
    const content = event.content && typeof event.content === "object" ? event.content : {};
    if (!match || !this.messageTypes.has(content.msgtype)) return false;
    const encrypted = content.file && typeof content.file === "object" && String(content.file.url || "").startsWith("mxc://");
    const plaintext = String(content.url || "").startsWith("mxc://");
    if (!encrypted && !plaintext) throw new Error(`URage source ${this.kindLabel} must contain a Matrix media descriptor.`);
    const advertisedSize = Number(content.info && content.info.size);
    if (Number.isFinite(advertisedSize) && (advertisedSize <= 0 || advertisedSize > MAX_SOURCE_BYTES)) {
      throw new Error(`Matrix source ${this.kindLabel} is limited to 20 MiB.`);
    }
    this.entries.set(match[1], {roomId: String(event.roomId || ""), sender: String(event.sender || ""), content, encrypted, createdAt: this.now()});
    while (this.entries.size > MAX_ENTRIES) this.entries.delete(this.entries.keys().next().value);
    return true;
  }

  async consume(sourceId, roomId, sender, allowUnencryptedMedia = false) {
    this.prune();
    const normalizedId = String(sourceId || "").trim();
    let entry = this.entries.get(normalizedId);
    // A media upload and its correlated command are sent back-to-back. Matrix
    // can deliver the command to the bot's sync callback first, so give the
    // matching attachment a short, bounded window to arrive.
    for (let attempt = 0; !entry && attempt < 20; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 250));
      this.prune();
      entry = this.entries.get(normalizedId);
    }
    if (!entry) throw new Error(`The Matrix source ${this.kindLabel} is missing or expired. Attach it again.`);
    if (entry.roomId !== roomId || entry.sender !== sender) throw new Error(`The Matrix source ${this.kindLabel} does not belong to this workflow sender and room.`);
    if (!entry.encrypted && !allowUnencryptedMedia) throw new Error("This source is in an unencrypted Matrix room. Confirm the unencrypted-media risk in Android before using it.");
    this.entries.delete(normalizedId);
    const data = await this.downloadSourceMedia(entry.content);
    if (!Buffer.isBuffer(data) || data.length === 0 || data.length > MAX_SOURCE_BYTES) throw new Error(`The Matrix source ${this.kindLabel} is empty or exceeds 20 MiB.`);
    const contentType = this.detectContentType(data);
    if (!contentType) throw new Error(`The Matrix attachment is not a supported ${this.kindLabel} file.`);
    return this.toPayload(data, contentType, safeFileName(entry.content.filename, this.fallbackExtension));
  }

  prune() {
    const cutoff = this.now() - SOURCE_TTL_MS;
    for (const [id, entry] of this.entries) if (entry.createdAt < cutoff) this.entries.delete(id);
  }
}

class MatrixSourceImageRegistry extends MatrixSourceRegistry {
  constructor(downloadSourceMedia, now) {
    super(downloadSourceMedia, {
      marker: /^URAGE_SOURCE ([a-zA-Z0-9_-]{8,80})$/,
      messageType: "m.image", kindLabel: "image", detectContentType: detectImageContentType,
      fallbackExtension: ".jpg", now,
      toPayload: (data, contentType, fileName) => ({imageInput: `data:${contentType};base64,${data.toString("base64")}`, imageFileName: fileName})
    });
  }
}

class MatrixSourceAudioRegistry extends MatrixSourceRegistry {
  constructor(downloadSourceMedia, now) {
    super(downloadSourceMedia, {
      marker: /^URAGE_AUDIO_SOURCE ([a-zA-Z0-9_-]{8,80})$/,
      messageTypes: ["m.file", "m.audio"], kindLabel: "audio", detectContentType: detectAudioContentType,
      fallbackExtension: ".m4a", now,
      toPayload: (data, contentType, fileName) => ({audioDataUrl: `data:${contentType};base64,${data.toString("base64")}`, audioFileName: fileName})
    });
  }
}

module.exports = {MatrixSourceImageRegistry, MatrixSourceAudioRegistry, detectImageContentType, detectAudioContentType};
