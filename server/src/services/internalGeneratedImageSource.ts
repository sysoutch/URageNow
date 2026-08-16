import { stat } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../config/appConfig.js";
import { resolveGeneratedImageFilePath } from "./generatedMediaLibrary.js";
import { sanitizeFileName } from "./model3d/fileNaming.js";

function parseQueryFromApiLikeSource(input: string): URLSearchParams | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname.toLowerCase() !== "/api/generated-image-file") {
        return null;
      }
      return parsed.searchParams;
    } catch {
      return null;
    }
  }
  const normalized = trimmed.replace(/\\/g, "/");
  const marker = "/api/generated-image-file?";
  const markerIndex = normalized.toLowerCase().indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }
  return new URLSearchParams(normalized.slice(markerIndex + marker.length));
}

export function parseGeneratedImageApiSource(input: string): { imageId: string; fileName: string } | null {
  const params = parseQueryFromApiLikeSource(input);
  if (!params) {
    return null;
  }
  const imageId = params.get("imageId")?.trim() ?? "";
  const fileName = params.get("file")?.trim() ?? "";
  if (!imageId || !fileName) {
    return null;
  }
  return { imageId, fileName };
}

export async function resolveGeneratedImageApiSourceToFilePath(input: string): Promise<string | null> {
  const parsed = parseGeneratedImageApiSource(input);
  if (!parsed) {
    return null;
  }
  try {
    return await resolveGeneratedImageFilePath(parsed.imageId, parsed.fileName);
  } catch {
    const safeImageId = sanitizeFileName(parsed.imageId, "");
    const safeFileName = sanitizeFileName(parsed.fileName, "");
    if (!safeImageId || !safeFileName) {
      return null;
    }
    const fallbackPath = path.join(path.resolve(appConfig.dataDirectory), "generated-images", safeImageId, safeFileName);
    try {
      await stat(fallbackPath);
      return fallbackPath;
    } catch {
      return null;
    }
  }
}
