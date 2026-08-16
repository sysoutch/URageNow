import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { resolveGeneratedImageApiSourceToFilePath } from "../internalGeneratedImageSource.js";
import type { LlmProvider } from "./runtime.js";

type SharpPipeline = {
  flatten: (input: { background: string }) => SharpPipeline;
  jpeg: (input: { quality: number }) => SharpPipeline;
  toBuffer: () => Promise<Buffer>;
};
type SharpFactory = (input: Buffer, options?: { animated?: boolean }) => SharpPipeline;
const createSharp = sharp as SharpFactory;

function decodeDataUrl(dataUrl: string): { mimeType: string | null; buffer: Buffer } {
  const trimmed = dataUrl.trim();
  const mimeMatch = /^data:([^;,]+)(?:;[^,]+)?,/i.exec(trimmed);
  const marker = ";base64,";
  const markerIndex = trimmed.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error("Only base64 image data URLs are supported.");
  }
  return {
    mimeType: mimeMatch?.[1]?.trim().toLowerCase() ?? null,
    buffer: Buffer.from(trimmed.slice(markerIndex + marker.length).trim(), "base64")
  };
}

function normalizePossibleFilePath(input: string): string {
  const trimmed = input.trim().replace(/^"(.*)"$/, "$1");
  if (trimmed.startsWith("file://")) {
    return fileURLToPath(trimmed);
  }
  return trimmed;
}

function inferMimeTypeFromSourceName(sourceName: string | null | undefined): string | null {
  if (!sourceName) {
    return null;
  }
  const normalized = sourceName.toLowerCase();
  if (/\.png(?:$|[?#])/i.test(normalized)) return "image/png";
  if (/\.jpe?g(?:$|[?#])/i.test(normalized)) return "image/jpeg";
  if (/\.webp(?:$|[?#])/i.test(normalized)) return "image/webp";
  if (/\.gif(?:$|[?#])/i.test(normalized)) return "image/gif";
  if (/\.bmp(?:$|[?#])/i.test(normalized)) return "image/bmp";
  if (/\.tiff?(?:$|[?#])/i.test(normalized)) return "image/tiff";
  return null;
}

function shouldConvertWebp(input: { mimeType?: string | null; sourceName?: string | null }): boolean {
  if (typeof input.mimeType === "string" && input.mimeType.toLowerCase().includes("image/webp")) {
    return true;
  }
  if (typeof input.sourceName === "string" && /\.webp(?:$|[?#])/i.test(input.sourceName)) {
    return true;
  }
  return false;
}

async function preprocessImageBuffer(bytes: Buffer, input: { mimeType?: string | null; sourceName?: string | null }): Promise<{ bytes: Buffer; mimeType: string }> {
  const inferredMime = input.mimeType?.trim().toLowerCase() || inferMimeTypeFromSourceName(input.sourceName) || "image/png";
  if (!shouldConvertWebp(input)) {
    return { bytes, mimeType: inferredMime };
  }
  const converted = await createSharp(bytes, { animated: false })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92 })
    .toBuffer();
  return {
    bytes: converted,
    mimeType: "image/jpeg"
  };
}

async function fetchImageAsProviderInput(input: string, provider: LlmProvider): Promise<string> {
  const response = await fetch(input);
  if (!response.ok) {
    throw new Error(`Image fetch failed with status ${response.status}`);
  }
  const rawBytes = Buffer.from(await response.arrayBuffer());
  const prepared = await preprocessImageBuffer(rawBytes, {
    mimeType: response.headers.get("content-type"),
    sourceName: input
  });
  return provider === "ollama"
    ? prepared.bytes.toString("base64")
    : `data:${prepared.mimeType};base64,${prepared.bytes.toString("base64")}`;
}

async function readLocalImageAsProviderInput(input: string, provider: LlmProvider): Promise<string> {
  const normalizedPath = normalizePossibleFilePath(input);
  const rawBytes = await readFile(normalizedPath);
  const prepared = await preprocessImageBuffer(rawBytes, { sourceName: normalizedPath });
  return provider === "ollama"
    ? prepared.bytes.toString("base64")
    : `data:${prepared.mimeType};base64,${prepared.bytes.toString("base64")}`;
}

export async function resolveImageInputForProvider(input: string, provider: LlmProvider): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Image input cannot be empty.");
  }
  const generatedImagePath = await resolveGeneratedImageApiSourceToFilePath(trimmed);
  if (generatedImagePath) {
    return readLocalImageAsProviderInput(generatedImagePath, provider);
  }
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)) {
    const decoded = decodeDataUrl(trimmed);
    const prepared = await preprocessImageBuffer(decoded.buffer, { mimeType: decoded.mimeType });
    return provider === "ollama"
      ? prepared.bytes.toString("base64")
      : `data:${prepared.mimeType};base64,${prepared.bytes.toString("base64")}`;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return fetchImageAsProviderInput(trimmed, provider);
  }
  return readLocalImageAsProviderInput(trimmed, provider);
}
