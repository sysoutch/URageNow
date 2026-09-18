import { readFileSync } from "node:fs";
import path from "node:path";
import { toolsRoot } from "@urage/server/config/repositoryPaths";
import type { DashboardDependencies } from "../runtime/botBridge.js";
import { convertImageToPixelArt } from "./pixelArtConverter.js";

export interface ServerToolDefinition {
  id: string;
  title: string;
  description: string;
  inputSchema: object;
}

interface ServerToolAdapter extends ServerToolDefinition {
  invoke(input: Record<string, unknown>, dependencies: DashboardDependencies): Promise<unknown>;
}

export class ToolInvocationError extends Error {
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}

function requiredText(input: Record<string, unknown>, key: string): string {
  const value = typeof input[key] === "string" ? input[key].trim() : "";
  if (!value) throw new ToolInvocationError(400, `${key} is required.`);
  return value;
}

function optionalPixelSize(input: Record<string, unknown>): number | undefined {
  if (input.pixelSize === undefined) return undefined;
  const value = Number(input.pixelSize);
  if (!Number.isFinite(value)) throw new ToolInvocationError(400, "pixelSize must be a finite number.");
  return Math.max(2, Math.min(256, Math.round(value)));
}

const serverToolAdapters: ServerToolAdapter[] = [
  {
    id: "art__pixel-art-converter",
    title: "Pixel Art Converter",
    description: "Transform an existing URage image into pixel art. This is not image generation.",
    inputSchema: {
      type: "object",
      required: ["imageId", "imageFileName"],
      properties: {
        imageId: { type: "string" },
        imageFileName: { type: "string" },
        pixelSize: { type: "number", minimum: 2, maximum: 256 }
      }
    },
    async invoke(input, dependencies) {
      const imageId = requiredText(input, "imageId");
      const imageFileName = requiredText(input, "imageFileName");
      const source = await dependencies.readGeneratedImageFile(imageId, imageFileName);
      const converted = await convertImageToPixelArt(source.data, optionalPixelSize(input));
      const sourceName = path.basename(imageFileName, path.extname(imageFileName)) || "image";
      const imported = await dependencies.importGeneratedImage({
        imageFileName: `${sourceName}-pixel-art.png`,
        imageData: converted.data,
        prompt: `Pixel art conversion of ${imageFileName}`,
        width: converted.width,
        height: converted.height,
        model: "Pixel Art Converter",
        metadata: {
          sourceTool: "art__pixel-art-converter",
          sourceImageId: imageId,
          sourceImageFileName: imageFileName,
          pixelSize: converted.pixelSize
        }
      });
      dependencies.runtimeState.recordAction("dashboard:pixel-art-converter", `Converted image ${imageId} to pixel art ${imported.id}.`);
      return imported;
    }
  }
];

const serverToolById = new Map(serverToolAdapters.map(adapter => [adapter.id, adapter]));

export async function invokeServerTool(toolId: string, input: Record<string, unknown>, dependencies: DashboardDependencies): Promise<unknown> {
  const adapter = serverToolById.get(toolId.trim());
  if (!adapter) throw new ToolInvocationError(404, `Tool '${toolId}' has no server-side endpoint.`);
  return adapter.invoke(input, dependencies);
}

export function listServerToolDefinitions(): ServerToolDefinition[] {
  return serverToolAdapters.map(({ id, title, description, inputSchema }) => ({ id, title, description, inputSchema }));
}

export function listToolCapabilities(): Array<Record<string, unknown>> {
  const serverDefinitions = new Map(listServerToolDefinitions().map(definition => [definition.id, definition]));
  try {
    const catalog = JSON.parse(readFileSync(path.join(toolsRoot, "catalog.json"), "utf8")) as { tools?: unknown };
    const entries = Array.isArray(catalog.tools) ? catalog.tools : [];
    return entries.flatMap(entry => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const value = entry as Record<string, unknown>;
      const id = typeof value.id === "string" ? value.id.trim() : "";
      const title = typeof value.title === "string" ? value.title.trim() : id;
      if (!id || !title) return [];
      const adapter = serverDefinitions.get(id);
      return [{
        id,
        title,
        description: typeof value.description === "string" ? value.description.trim() : "",
        execution: adapter ? "server" : "client",
        invocation: adapter ? { method: "POST", path: "/api/tools/invoke", inputSchema: adapter.inputSchema } : undefined
      }];
    });
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