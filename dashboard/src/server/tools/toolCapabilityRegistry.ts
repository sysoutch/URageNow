import { readFileSync } from "node:fs";
import path from "node:path";
import { toolsRoot } from "@urage/server/config/repositoryPaths";
import type { DashboardDependencies } from "../runtime/botBridge.js";
import { convertImageToPixelArt } from "./pixelArtConverter.js";
import { createAsciiArt, createNormalMap } from "./imageToolTransforms.js";

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
  },
  {
    id: "art__normalmap-maker", title: "Normalmap Maker", description: "Create a tangent-space normal map from an existing URage image.",
    inputSchema: { type: "object", required: ["imageId", "imageFileName"], properties: { imageId: { type: "string" }, imageFileName: { type: "string" }, strength: { type: "number", minimum: .1, maximum: 10 } } },
    async invoke(input, dependencies) {
      const imageId = requiredText(input, "imageId"); const imageFileName = requiredText(input, "imageFileName"); const strength = input.strength === undefined ? 2 : Number(input.strength);
      if (!Number.isFinite(strength)) throw new ToolInvocationError(400, "strength must be a finite number.");
      const converted = await createNormalMap((await dependencies.readGeneratedImageFile(imageId, imageFileName)).data, strength);
      const sourceName = path.basename(imageFileName, path.extname(imageFileName)) || "image";
      const imported = await dependencies.importGeneratedImage({ imageFileName: `${sourceName}-normal-map.png`, imageData: converted.data, prompt: `Normal map conversion of ${imageFileName}`, width: converted.width, height: converted.height, model: "Normalmap Maker", metadata: { sourceTool: "art__normalmap-maker", sourceImageId: imageId, sourceImageFileName: imageFileName, strength } });
      dependencies.runtimeState.recordAction("dashboard:normalmap-maker", `Converted image ${imageId} to normal map ${imported.id}.`); return imported;
    }
  },
  {
    id: "art__image-to-ascii", title: "Image To Ascii", description: "Convert an existing URage image to ASCII text and a downloadable ASCII preview image.",
    inputSchema: { type: "object", required: ["imageId", "imageFileName"], properties: { imageId: { type: "string" }, imageFileName: { type: "string" }, columns: { type: "number", minimum: 16, maximum: 160 } } },
    async invoke(input, dependencies) {
      const imageId = requiredText(input, "imageId"); const imageFileName = requiredText(input, "imageFileName"); const columns = input.columns === undefined ? 96 : Number(input.columns);
      if (!Number.isFinite(columns)) throw new ToolInvocationError(400, "columns must be a finite number.");
      const converted = await createAsciiArt((await dependencies.readGeneratedImageFile(imageId, imageFileName)).data, columns);
      const sourceName = path.basename(imageFileName, path.extname(imageFileName)) || "image";
      const imported = await dependencies.importGeneratedImage({ imageFileName: `${sourceName}-ascii.png`, imageData: converted.data, prompt: `ASCII conversion of ${imageFileName}`, width: converted.width, height: converted.height, model: "Image To Ascii", metadata: { sourceTool: "art__image-to-ascii", sourceImageId: imageId, sourceImageFileName: imageFileName, columns: converted.columns, rows: converted.rows } });
      dependencies.runtimeState.recordAction("dashboard:image-to-ascii", `Converted image ${imageId} to ASCII ${imported.id}.`); return { ...imported, asciiText: converted.text, columns: converted.columns, rows: converted.rows };
    }  }
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