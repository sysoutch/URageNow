import { readFileSync } from "node:fs";
import path from "node:path";
import { toolsRoot } from "@urage/server/config/repositoryPaths";
import type { DashboardDependencies } from "../runtime/botBridge.js";
import { serverToolAdapters } from "./builtInServerToolAdapters.js";
import { hasManifestAction, invokeManifestAction } from "./serverToolActionDispatcher.js";
import type { ServerToolDefinition } from "./serverToolContracts.js";
import { loadServerToolManifests } from "./serverToolManifest.js";
import { ToolInvocationError } from "./toolInvocationError.js";

export type { ServerToolDefinition } from "./serverToolContracts.js";
export { ToolInvocationError } from "./toolInvocationError.js";
const serverToolById = new Map(serverToolAdapters.map(adapter => [adapter.id, adapter]));

export async function invokeServerTool(toolId: string, input: Record<string, unknown>, dependencies: DashboardDependencies): Promise<unknown> {
  const requestedId = toolId.trim();
  const manifest = loadServerToolManifests().find(candidate => candidate.id === requestedId);
  if (manifest && hasManifestAction(manifest.action)) {
    return invokeManifestAction({ manifest, input, dependencies });
  }
  const adapter = serverToolById.get(requestedId) ?? (manifest ? serverToolAdapters.find(candidate => candidate.action === manifest.action) : undefined);
  if (!adapter) throw new ToolInvocationError(404, `Tool '${toolId}' has no server-side endpoint or approved action.`);
  return adapter.invoke({ ...input, __serverToolId: requestedId }, dependencies);
}

export function listServerToolDefinitions(): ServerToolDefinition[] {
  const manifests = loadServerToolManifests().filter(manifest => hasManifestAction(manifest.action) || serverToolAdapters.some(adapter => adapter.action === manifest.action));
  const manifestById = new Map(manifests.map(manifest => [manifest.id, manifest]));
  const builtIns = serverToolAdapters.map(({ id, title, description, inputSchema }) => {
    const manifest = manifestById.get(id);
    return manifest ? { id: manifest.id, title: manifest.title, description: manifest.description, inputSchema: manifest.inputSchema } : { id, title, description, inputSchema };
  });
  const builtInIds = new Set(builtIns.map(definition => definition.id));
  return [...builtIns, ...manifests.filter(manifest => !builtInIds.has(manifest.id)).map(({ id, title, description, inputSchema }) => ({ id, title, description, inputSchema }))];
}

export function listToolCapabilities(): Array<Record<string, unknown>> {
  const serverDefinitions = new Map(listServerToolDefinitions().map(definition => [definition.id, definition]));
  try {
    const catalog = JSON.parse(readFileSync(path.join(toolsRoot, "catalog.json"), "utf8")) as { tools?: unknown };
    const entries = Array.isArray(catalog.tools) ? catalog.tools : [];
    const catalogIds = new Set<string>();
    const catalogCapabilities = entries.flatMap(entry => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const value = entry as Record<string, unknown>;
      const id = typeof value.id === "string" ? value.id.trim() : "";
      const title = typeof value.title === "string" ? value.title.trim() : id;
      if (!id || !title) return [];
      catalogIds.add(id);
      const definition = serverDefinitions.get(id);
      return [{
        id,
        title: definition?.title ?? title,
        description: definition?.description || (typeof value.description === "string" ? value.description.trim() : ""),
        execution: definition ? "server" : "client",
        invocation: definition ? { method: "POST", path: "/api/tools/invoke", inputSchema: definition.inputSchema } : undefined
      }];
    });
    const manifestOnlyCapabilities = [...serverDefinitions.values()]
      .filter(definition => !catalogIds.has(definition.id))
      .map(definition => ({
        id: definition.id,
        title: definition.title,
        description: definition.description,
        execution: "server",
        invocation: { method: "POST", path: "/api/tools/invoke", inputSchema: definition.inputSchema }
      }));
    return [...catalogCapabilities, ...manifestOnlyCapabilities];
  } catch {
    return listServerToolDefinitions().map(definition => ({
      id: definition.id,
      title: definition.title,
      description: definition.description,
      execution: "server",
      invocation: { method: "POST", path: "/api/tools/invoke", inputSchema: definition.inputSchema }
    }));
  }
}