import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { appConfig } from "@urage/server/config/appConfig";

export interface ToolArtifact {
  id: string;
  createdAt: string;
  sourceToolId: string;
  fileName: string;
  mimeType: string;
  byteLength: number;
  downloadUrl: string;
  metadata: Record<string, string | number | boolean>;
}

interface StoredToolArtifact extends ToolArtifact {
  storageFileName: string;
}

const artifactRoot = path.resolve(appConfig.dataDirectory, "tool-artifacts");

function safeFileName(value: string, fallback: string): string {
  const normalized = path.basename(value.trim() || fallback).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 160);
  return normalized || fallback;
}

function safeMetadata(value: Record<string, string | number | boolean> | undefined): Record<string, string | number | boolean> {
  if (!value) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === "string" || typeof item === "boolean" || (typeof item === "number" && Number.isFinite(item))));
}

function artifactDirectory(id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Tool artifact was not found.");
  return path.join(artifactRoot, id);
}

function toPublicArtifact(stored: StoredToolArtifact): ToolArtifact {
  const { storageFileName: _storageFileName, ...artifact } = stored;
  return artifact;
}

export async function saveToolArtifact(input: {
  sourceToolId: string;
  fileName: string;
  mimeType: string;
  data: Buffer | string;
  metadata?: Record<string, string | number | boolean>;
}): Promise<ToolArtifact> {
  const sourceToolId = input.sourceToolId.trim();
  if (!sourceToolId) throw new Error("sourceToolId is required when saving a tool artifact.");
  const fileName = safeFileName(input.fileName, "artifact.bin");
  const data = Buffer.isBuffer(input.data) ? input.data : Buffer.from(input.data, "utf8");
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const stored: StoredToolArtifact = {
    id,
    createdAt,
    sourceToolId,
    fileName,
    mimeType: input.mimeType.trim() || "application/octet-stream",
    byteLength: data.length,
    downloadUrl: `/api/tool-artifact?artifactId=${encodeURIComponent(id)}&file=${encodeURIComponent(fileName)}`,
    metadata: safeMetadata(input.metadata),
    storageFileName: fileName
  };
  const directory = artifactDirectory(id);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(path.join(directory, stored.storageFileName), data),
    writeFile(path.join(directory, "metadata.json"), JSON.stringify(stored, null, 2), "utf8")
  ]);
  return toPublicArtifact(stored);
}

export async function readToolArtifact(id: string, requestedFileName: string): Promise<{ artifact: ToolArtifact; data: Buffer }> {
  const directory = artifactDirectory(id.trim());
  let stored: StoredToolArtifact;
  try {
    stored = JSON.parse(await readFile(path.join(directory, "metadata.json"), "utf8")) as StoredToolArtifact;
  } catch {
    throw new Error("Tool artifact was not found.");
  }
  const expectedName = safeFileName(requestedFileName, "");
  if (stored.id !== id || !stored.storageFileName || stored.fileName !== expectedName || stored.storageFileName !== expectedName) {
    throw new Error("Tool artifact was not found.");
  }
  try {
    return { artifact: toPublicArtifact(stored), data: await readFile(path.join(directory, stored.storageFileName)) };
  } catch {
    throw new Error("Tool artifact file was not found.");
  }
}
