import { Colors, EmbedBuilder } from "discord.js";
import path from "node:path";
import type { GeneratedModelPublicRecord } from "@urage/server/services/model3d";
import type {
  EditableModelMessage,
  ModelTextureMessageLinks,
  SendableGuildChannel
} from "./modelPostTypes.js";

export const MODEL_FOLLOW_UP_DELAY_MS = 900;
export const DEFAULT_LOW_POLY_TARGET_FACE_COUNT = 1500;

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export function asSendableGuildChannel(value: unknown): SendableGuildChannel | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (!("id" in value) || typeof (value as { id?: unknown }).id !== "string") {
    return null;
  }
  if (!("guildId" in value) || typeof (value as { guildId?: unknown }).guildId !== "string") {
    return null;
  }
  if (!("send" in value) || typeof (value as { send?: unknown }).send !== "function") {
    return null;
  }
  return value as SendableGuildChannel;
}

export function asEditableModelMessage(value: unknown): EditableModelMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  if (!("id" in value) || typeof (value as { id?: unknown }).id !== "string") {
    return null;
  }
  if (!("edit" in value) || typeof (value as { edit?: unknown }).edit !== "function") {
    return null;
  }
  return value as EditableModelMessage;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildDefaultThreadName(): string {
  return `Model ${new Date().toISOString().slice(0, 10)}`;
}

export function toReadableModelName(fileName: string): string {
  const stem = path.basename(fileName.trim(), path.extname(fileName.trim())).trim();
  const normalized = stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "Model";
  }
  return normalized.slice(0, 90);
}

export function buildDiscordMessageUrl(guildId: string, channelId: string, messageId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

export function hasAnyTextureLinks(links: ModelTextureMessageLinks | undefined): boolean {
  return Boolean(links?.multiViewUrl || links?.uvMapUrl || links?.normalMapUrl);
}

export function formatTargetFaceCount(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "`unknown`";
  }
  return `\`${Math.round(value).toLocaleString("en-US")}\``;
}

export function formatToggleState(value: boolean): string {
  return value ? "`enabled`" : "`disabled`";
}

export function formatRealWorldDimensionsMeters(record: GeneratedModelPublicRecord): string {
  const widthMeters = record.lowPolyRealWorldWidthMeters;
  const heightMeters = record.lowPolyRealWorldHeightMeters;
  const depthMeters = record.lowPolyRealWorldDepthMeters;
  if (!widthMeters || !heightMeters || !depthMeters) {
    return "`n/a`";
  }
  return `\`${widthMeters.toFixed(2)}m x ${heightMeters.toFixed(2)}m x ${depthMeters.toFixed(2)}m\``;
}

export function formatLowPolyReference(record: GeneratedModelPublicRecord): string {
  const reference = record.lowPolyRealWorldReference?.trim() ?? "";
  if (!reference) {
    return "`n/a`";
  }
  return `\`${reference.slice(0, 180)}\``;
}

export function normalizePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    return rounded > 0 ? rounded : fallback;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

export function isImageAttachmentName(value: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(value);
}

function isModelAttachmentName(value: string): boolean {
  return /\.(glb|gltf|obj|fbx|stl|ply)$/i.test(value);
}

export function normalizeDiscordAttachmentUrl(value: string): string {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const isDiscordHost = host.endsWith("discordapp.com") || host.endsWith("discord.com");
    const isAttachmentPath = parsed.pathname.includes("/attachments/");
    if (isDiscordHost && isAttachmentPath) {
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    }
    return value;
  } catch {
    return value;
  }
}

export function normalizeDiscordMessageUrl(value: string): string {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const isDiscordHost = host.endsWith("discordapp.com") || host.endsWith("discord.com");
    const isMessagePath = parsed.pathname.includes("/channels/");
    if (isDiscordHost && isMessagePath) {
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    }
    return value;
  } catch {
    return value;
  }
}

function looksLikeDirectImageUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return /\.(gif|png|jpe?g|webp|bmp|tiff?)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function buildLinkedPreviewEmbed(url: string): EmbedBuilder | null {
  const normalized = normalizeDiscordAttachmentUrl(url);
  if (!looksLikeDirectImageUrl(normalized)) {
    return null;
  }
  return new EmbedBuilder().setColor(Colors.Blurple).setTitle("🖼️ Preview").setImage(normalized);
}

function asAttachmentEntries(value: unknown): Array<{ url: string; contentType: string; name: string; }> {
  if (!value || typeof value !== "object") {
    return [];
  }
  const entries: unknown[] = [];
  const maybeValues = value as { values?: unknown };
  if (typeof maybeValues.values === "function") {
    try {
      for (const item of (maybeValues.values as () => Iterable<unknown>)()) {
        entries.push(item);
      }
    } catch {
      // ignore malformed attachment collections
    }
  } else if (Array.isArray(value)) {
    entries.push(...value);
  }
  return entries.map(entry => {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const url = typeof (entry as { url?: unknown }).url === "string" ? (entry as { url: string }).url : "";
    const proxyUrl = typeof (entry as { proxyURL?: unknown }).proxyURL === "string" ? (entry as { proxyURL: string }).proxyURL : "";
    const contentType = typeof (entry as { contentType?: unknown }).contentType === "string" ? (entry as { contentType: string }).contentType : "";
    const name = typeof (entry as { name?: unknown }).name === "string" ? (entry as { name: string }).name : "";
    const resolvedUrl = url || proxyUrl;
    if (!resolvedUrl) {
      return null;
    }
    return {
      url: normalizeDiscordAttachmentUrl(resolvedUrl),
      contentType,
      name
    };
  }).filter((entry): entry is { url: string; contentType: string; name: string; } => entry !== null);
}

export function extractMessageUrl(message: unknown): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const url = (message as { url?: unknown }).url;
  if (typeof url !== "string" || !url.trim()) {
    return undefined;
  }
  return normalizeDiscordMessageUrl(url);
}

export function extractPreviewMediaUrl(message: unknown): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const attachments = asAttachmentEntries((message as { attachments?: unknown }).attachments);
  if (attachments.length === 0) {
    return undefined;
  }
  const gifAttachment = attachments.find(entry => entry.contentType.toLowerCase() === "image/gif" || /\.gif$/i.test(entry.name));
  if (gifAttachment) {
    return gifAttachment.url;
  }
  const imageAttachment = attachments.find(entry => entry.contentType.toLowerCase().startsWith("image/") || isImageAttachmentName(entry.name));
  return imageAttachment?.url;
}

export function extractModelMediaUrl(message: unknown, modelFileName?: string): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const attachments = asAttachmentEntries((message as { attachments?: unknown }).attachments);
  if (attachments.length === 0) {
    return undefined;
  }
  const normalizedModelName = modelFileName?.trim().toLowerCase() ?? "";
  if (normalizedModelName) {
    const exact = attachments.find(entry => entry.name.toLowerCase() === normalizedModelName);
    if (exact) {
      return exact.url;
    }
  }
  const modelAttachment = attachments.find(entry => {
    const contentType = entry.contentType.toLowerCase();
    return isModelAttachmentName(entry.name) || contentType.includes("model/") || contentType.includes("gltf");
  });
  return modelAttachment?.url;
}

export function extractSourceImageUrl(message: unknown, sourceImageFileName?: string): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const attachments = asAttachmentEntries((message as { attachments?: unknown }).attachments);
  if (attachments.length === 0) {
    return undefined;
  }
  const normalizedSourceName = sourceImageFileName?.trim().toLowerCase() ?? "";
  if (normalizedSourceName) {
    const exact = attachments.find(entry => entry.name.toLowerCase() === normalizedSourceName);
    if (exact) {
      return exact.url;
    }
  }
  const imageAttachment = attachments.find(entry => {
    const contentType = entry.contentType.toLowerCase();
    if (contentType === "image/gif" || /\.gif$/i.test(entry.name)) {
      return false;
    }
    return contentType.startsWith("image/") || isImageAttachmentName(entry.name);
  });
  return imageAttachment?.url;
}

export function mergeExtraContent(parts: Array<string | undefined>): string | undefined {
  const merged = parts.map(entry => entry?.trim() ?? "").filter(Boolean).join("\n\n").trim();
  return merged || undefined;
}

export function buildModelPostSummaryExtraContent(input: {
  modelFileName?: string;
  description?: string | null;
  prompt?: string | null;
  extraContent?: string | null;
}): string | undefined {
  const modelFileName = String(input.modelFileName || "").trim() || "model.glb";
  const description = String(input.description || "").trim() || String(input.prompt || "").trim();
  return mergeExtraContent([
    `📦 Model:\n\`${modelFileName}\``,
    description ? `📝 Description:\n${description.slice(0, 1200)}` : undefined,
    String(input.extraContent || "").trim() || undefined
  ]);
}

export function parseGifDataUrl(dataUrl: string): Buffer {
  const match = dataUrl.trim().match(/^data:([^,]*),(.+)$/i);
  if (!match) {
    throw new Error("A valid image data URL is required for the preview GIF.");
  }
  const metadata = (match[1] ?? "").toLowerCase();
  if (!metadata.includes(";base64")) {
    throw new Error("Preview GIF data URL must be base64-encoded.");
  }
  const mimeType = metadata.split(";")[0] ?? "";
  const payload = match[2] ?? "";
  if (!payload) {
    throw new Error("Preview GIF payload is empty.");
  }
  const bytes = Buffer.from(payload, "base64");
  const header = bytes.subarray(0, 6).toString("ascii");
  const hasGifHeader = header === "GIF87a" || header === "GIF89a";
  if (!hasGifHeader) {
    throw new Error("Preview GIF payload is not a valid GIF.");
  }
  if (mimeType && mimeType !== "image/gif" && mimeType !== "application/octet-stream") {
    throw new Error("Preview GIF data must use image/gif.");
  }
  return bytes;
}

export async function resolveOptionalGeneratedModelFilePath(
  resolvePath: (modelId: string, fileName: string) => Promise<string>,
  modelId: string,
  fileName: string,
  label: string
): Promise<string | null> {
  try {
    return await resolvePath(modelId, fileName);
  } catch (error) {
    console.warn(`Skipping missing ${label} file "${fileName}" for model ${modelId}.`, error);
    return null;
  }
}
