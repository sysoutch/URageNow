import {readFile, stat} from "node:fs/promises";
import path from "node:path";
import {loadLocalToolsFromDisk, resolveToolsRootDirectory} from "../chatSkills/catalog.js";

export type CompanionTool = {
  id: string;
  category: string;
  categoryLabel: string;
  title: string;
  description: string;
  entryPath: string;
  coverPath: string;
};

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export async function listCompanionTools(): Promise<CompanionTool[]> {
  return (await loadLocalToolsFromDisk()).map(tool => ({
    id: tool.id,
    category: tool.category,
    categoryLabel: tool.categoryLabel,
    title: tool.title,
    description: tool.description,
    entryPath: tool.sourcePath,
    coverPath: tool.coverPath,
  }));
}

export async function readCompanionToolFile(requestedPath: string): Promise<{contentType: string; data: Buffer} | null> {
  const root = await resolveToolsRootDirectory();
  if (!root) return null;
  const normalizedRequest = String(requestedPath || "").replace(/\\/g, "/");
  if (!normalizedRequest.startsWith("/tools/") || normalizedRequest.includes("\0")) return null;
  let relativePath = "";
  try {
    relativePath = decodeURIComponent(normalizedRequest.slice("/tools/".length));
  } catch {
    return null;
  }
  const resolvedRoot = path.resolve(root);
  let resolvedFile = path.resolve(resolvedRoot, relativePath);
  if (resolvedFile !== resolvedRoot && !resolvedFile.startsWith(resolvedRoot + path.sep)) return null;
  try {
    if ((await stat(resolvedFile)).isDirectory()) resolvedFile = path.join(resolvedFile, "index.html");
    const data = await readFile(resolvedFile);
    return {contentType: mimeTypes[path.extname(resolvedFile).toLowerCase()] || "application/octet-stream", data};
  } catch {
    return null;
  }
}
