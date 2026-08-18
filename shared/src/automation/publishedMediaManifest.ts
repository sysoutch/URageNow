import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AutomationTargetMessenger } from "./types.js";

export const publishedMediaManifestFileName = "automation-published-media.json";

export interface PublishedMediaAsset {
  kind: "image" | "video" | "model" | "preview" | "gif" | "texture" | "other";
  fileName?: string;
  /** A dashboard-owned or published website URL. Never put credentials here. */
  directUrl?: string;
}

export interface PublishedMediaManifestEntry {
  id: string;
  sentAt: string;
  automationId: string;
  automationName: string;
  messenger: AutomationTargetMessenger;
  destinationId: string;
  messageUrl?: string;
  assets: PublishedMediaAsset[];
}

interface PublishedMediaManifest {
  schemaVersion: 1;
  updatedAt: string;
  entries: PublishedMediaManifestEntry[];
}

let writeQueue = Promise.resolve();

export function getPublishedMediaManifestPath(dataDirectory: string): string {
  return path.resolve(dataDirectory, publishedMediaManifestFileName);
}

export function appendPublishedMediaManifestEntry(dataDirectory: string, entry: PublishedMediaManifestEntry): Promise<void> {
  const operation = writeQueue.then(async () => {
    const filePath = getPublishedMediaManifestPath(dataDirectory);
    await mkdir(path.dirname(filePath), { recursive: true });
    let current: PublishedMediaManifest = { schemaVersion: 1, updatedAt: entry.sentAt, entries: [] };
    try {
      const parsed = JSON.parse(await readFile(filePath, "utf8")) as Partial<PublishedMediaManifest>;
      current = {
        schemaVersion: 1,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : entry.sentAt,
        entries: Array.isArray(parsed.entries) ? parsed.entries : []
      };
    } catch {
      // A missing or malformed optional feed must never make a delivery fail.
    }
    current.entries.push(entry);
    current.entries = current.entries.slice(-1000);
    current.updatedAt = entry.sentAt;
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
    await rename(temporaryPath, filePath);
  });
  writeQueue = operation.catch(() => undefined);
  return operation;
}
