import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { toolsRoot } from "@urage/server/config/repositoryPaths";

export interface ServerToolManifest {
  id: string;
  title: string;
  description: string;
  action: string;
  inputSchema: object;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseManifest(filePath: string): ServerToolManifest | undefined {
  try {
    const value: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const manifest = value as Record<string, unknown>;
    const id = asNonEmptyString(manifest.id);
    const action = asNonEmptyString(manifest.action);
    const title = asNonEmptyString(manifest.title);
    if (!id || !action || !title || !manifest.inputSchema || typeof manifest.inputSchema !== "object" || Array.isArray(manifest.inputSchema)) return undefined;
    return {
      id,
      action,
      title,
      description: asNonEmptyString(manifest.description) ?? "",
      inputSchema: manifest.inputSchema
    };
  } catch {
    return undefined;
  }
}

function manifestPaths(): string[] {
  try {
    return readdirSync(toolsRoot, { withFileTypes: true })
      .filter(category => category.isDirectory())
      .flatMap(category => readdirSync(path.join(toolsRoot, category.name), { withFileTypes: true })
        .filter(tool => tool.isDirectory())
        .map(tool => path.join(toolsRoot, category.name, tool.name, "server-tool.json")))
      .sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

/**
 * Reads declarative tool manifests at request time. A manifest selects a vetted
 * server action; it never loads executable code from the tool directory.
 */
export function loadServerToolManifests(): ServerToolManifest[] {
  const seenIds = new Set<string>();
  const manifests: ServerToolManifest[] = [];
  for (const filePath of manifestPaths()) {
    const manifest = parseManifest(filePath);
    if (!manifest || seenIds.has(manifest.id)) continue;
    seenIds.add(manifest.id);
    manifests.push(manifest);
  }
  return manifests;
}