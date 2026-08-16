import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@urage/server/config/appConfig";

export type CompanionMediaKind = "image" | "audio" | "video" | "model3d";
const uploadRoot = path.resolve(appConfig.dataDirectory, "companion-uploads");
const allowedKinds = new Set<CompanionMediaKind>(["image", "audio", "video", "model3d"]);

export function parseCompanionMediaKind(value: string | null): CompanionMediaKind | null {
  return allowedKinds.has(value as CompanionMediaKind) ? value as CompanionMediaKind : null;
}

function sanitizeFileName(value: string): string {
  return path.basename(value).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "upload.bin";
}

function resolveUploadPath(kind: CompanionMediaKind, id: string, fileName: string): string {
  const directory = path.resolve(uploadRoot, kind, path.basename(id));
  const target = path.resolve(directory, sanitizeFileName(fileName));
  if (!target.startsWith(directory + path.sep)) throw new Error("Invalid companion media path.");
  return target;
}

export async function saveCompanionUpload(input: { kind: CompanionMediaKind; fileName: string; contentType: string; data: Buffer }): Promise<Record<string, unknown>> {
  const id = `${Date.now().toString(36)}-${randomBytes(5).toString("hex")}`;
  const fileName = sanitizeFileName(input.fileName);
  const target = resolveUploadPath(input.kind, id, fileName);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, input.data);
  const record = { id, kind: input.kind, fileName, contentType: input.contentType || "application/octet-stream", createdAt: new Date().toISOString(), size: input.data.length };
  await writeFile(path.join(path.dirname(target), "metadata.json"), JSON.stringify(record, null, 2) + "\n", "utf8");
  return record;
}

export async function listCompanionUploads(kind: CompanionMediaKind): Promise<Array<Record<string, unknown>>> {
  let entries;
  const directory = path.resolve(uploadRoot, kind);
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const records = await Promise.all(entries.filter(entry => entry.isDirectory()).map(async entry => {
    try {
      return JSON.parse(await readFile(path.join(directory, entry.name, "metadata.json"), "utf8")) as Record<string, unknown>;
    } catch {
      return null;
    }
  }));
  return records.filter((entry): entry is Record<string, unknown> => entry !== null)
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
}

export async function readCompanionUpload(kind: CompanionMediaKind, id: string, fileName: string): Promise<{ data: Buffer; contentType: string }> {
  const target = resolveUploadPath(kind, id, fileName);
  const metadata = JSON.parse(await readFile(path.join(path.dirname(target), "metadata.json"), "utf8")) as { contentType?: string };
  return { data: await readFile(target), contentType: metadata.contentType || "application/octet-stream" };
}

export async function updateCompanionUploadMetadata(
  kind: CompanionMediaKind,
  id: string,
  fileName: string,
  input: {title?: string}
): Promise<Record<string, unknown>> {
  const target = resolveUploadPath(kind, id, fileName);
  const metadataPath = path.join(path.dirname(target), "metadata.json");
  const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as Record<string, unknown>;
  if (typeof input.title === "string") metadata.title = input.title.trim().slice(0, 200);
  metadata.updatedAt = new Date().toISOString();
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + "\n", "utf8");
  return metadata;
}

export async function deleteCompanionUpload(kind: CompanionMediaKind, id: string, fileName: string): Promise<boolean> {
  const target = resolveUploadPath(kind, id, fileName);
  try {
    await rm(path.dirname(target), {recursive: true, force: false});
    return true;
  } catch {
    return false;
  }
}
