import path from "node:path";
import type { ToolActionDependencies } from "./serverToolContracts.js";
import { serverImageToolActions } from "./serverImageToolActions.js";
import type { ServerToolAdapter } from "./serverToolContracts.js";
import { ToolInvocationError } from "./toolInvocationError.js";

/**
 * Compatibility implementations for built-in tools. New tools use a nearby
 * server-tool.json and a vetted action instead of extending this list.
 */
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
function asciiCharacterSet(input: Record<string, unknown>): "dense" | "blocks" | "detailed" | "classic" {
  const value = input.characterSet === undefined ? "detailed" : requiredText(input, "characterSet");
  if (!["dense", "blocks", "detailed", "classic"].includes(value)) throw new ToolInvocationError(400, "characterSet must be dense, blocks, detailed, or classic.");
  return value as "dense" | "blocks" | "detailed" | "classic";
}

function asciiColorMode(input: Record<string, unknown>): "mono" | "color" | "green" {
  const value = input.colorMode === undefined ? "color" : requiredText(input, "colorMode");
  if (!["mono", "color", "green"].includes(value)) throw new ToolInvocationError(400, "colorMode must be mono, color, or green.");
  return value as "mono" | "color" | "green";
}

export const serverToolAdapters: ServerToolAdapter[] = [
  {
    id: "art__pixel-art-converter", action: "pixel-art",
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
      const converted = await serverImageToolActions.pixelArt(source.data, optionalPixelSize(input));
      const sourceName = path.basename(imageFileName, path.extname(imageFileName)) || "image";
      const imported = await dependencies.importGeneratedImage({
        imageFileName: `${sourceName}-pixel-art.png`,
        imageData: converted.data,
        prompt: `Pixel art conversion of ${imageFileName}`,
        width: converted.width,
        height: converted.height,
        model: "Pixel Art Converter",
        metadata: {
          sourceTool: typeof input.__serverToolId === "string" ? input.__serverToolId : "art__pixel-art-converter",
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
    id: "art__normalmap-maker", action: "normal-map", title: "Normalmap Maker", description: "Create a tangent-space normal map from an existing URage image.",
    inputSchema: { type: "object", required: ["imageId", "imageFileName"], properties: { imageId: { type: "string" }, imageFileName: { type: "string" }, strength: { type: "number", minimum: .1, maximum: 10 } } },
    async invoke(input, dependencies) {
      const imageId = requiredText(input, "imageId"); const imageFileName = requiredText(input, "imageFileName"); const strength = input.strength === undefined ? 2 : Number(input.strength);
      if (!Number.isFinite(strength)) throw new ToolInvocationError(400, "strength must be a finite number.");
      const converted = await serverImageToolActions.normalMap((await dependencies.readGeneratedImageFile(imageId, imageFileName)).data, strength);
      const sourceName = path.basename(imageFileName, path.extname(imageFileName)) || "image";
      const imported = await dependencies.importGeneratedImage({ imageFileName: `${sourceName}-normal-map.png`, imageData: converted.data, prompt: `Normal map conversion of ${imageFileName}`, width: converted.width, height: converted.height, model: "Normalmap Maker", metadata: { sourceTool: typeof input.__serverToolId === "string" ? input.__serverToolId : "art__normalmap-maker", sourceImageId: imageId, sourceImageFileName: imageFileName, strength } });
      dependencies.runtimeState.recordAction("dashboard:normalmap-maker", `Converted image ${imageId} to normal map ${imported.id}.`); return imported;
    }
  },
  {
    id: "art__image-to-ascii", action: "ascii",
    title: "Image To Ascii",
    description: "Convert an existing URage image to detailed, color ASCII text and a downloadable PNG or animated GIF preview.",
    inputSchema: {
      type: "object",
      required: ["imageId", "imageFileName"],
      properties: {
        imageId: { type: "string" },
        imageFileName: { type: "string" },
        columns: { type: "number", minimum: 16, maximum: 160, default: 100 },
        characterSet: { type: "string", enum: ["dense", "blocks", "detailed", "classic"], default: "detailed" },
        colorMode: { type: "string", enum: ["mono", "color", "green"], default: "color" }
      }
    },
    async invoke(input, dependencies) {
      const imageId = requiredText(input, "imageId");
      const imageFileName = requiredText(input, "imageFileName");
      const columns = input.columns === undefined ? 100 : Number(input.columns);
      if (!Number.isFinite(columns)) throw new ToolInvocationError(400, "columns must be a finite number.");
      const characterSet = asciiCharacterSet(input);
      const colorMode = asciiColorMode(input);
      const converted = await serverImageToolActions.ascii((await dependencies.readGeneratedImageFile(imageId, imageFileName)).data, { columns, characterSet, colorMode });
      const sourceName = path.basename(imageFileName, path.extname(imageFileName)) || "image";
      const imported = await dependencies.importGeneratedImage({
        imageFileName: `${sourceName}-ascii.${converted.extension}`,
        imageData: converted.data,
        prompt: `ASCII conversion of ${imageFileName}`,
        width: converted.width,
        height: converted.height,
        model: "Image To Ascii",
        metadata: {
          sourceTool: typeof input.__serverToolId === "string" ? input.__serverToolId : "art__image-to-ascii",
          sourceImageId: imageId,
          sourceImageFileName: imageFileName,
          columns: converted.columns,
          rows: converted.rows,
          characterSet,
          colorMode,
          frames: converted.frames,
          format: converted.extension
        }
      });
      dependencies.runtimeState.recordAction("dashboard:image-to-ascii", `Converted image ${imageId} to ASCII ${imported.id}.`);
      return { ...imported, asciiText: converted.text, columns: converted.columns, rows: converted.rows, frames: converted.frames, format: converted.extension };
    }
  },
  {
    id: "art__color-palette-extractor", action: "palette", title: "Color Palette Extractor", description: "Extract dominant colors from an existing URage image.",
    inputSchema: { type: "object", required: ["imageId", "imageFileName"], properties: { imageId: { type: "string" }, imageFileName: { type: "string" }, colorCount: { type: "number", minimum: 2, maximum: 32, default: 8 } } },
    async invoke(input, dependencies) {
      const imageId = requiredText(input, "imageId"); const imageFileName = requiredText(input, "imageFileName");
      const palette = await serverImageToolActions.palette((await dependencies.readGeneratedImageFile(imageId, imageFileName)).data, Number(input.colorCount ?? 8));
      dependencies.runtimeState.recordAction("dashboard:color-palette-extractor", `Extracted ${palette.length} colors from image ${imageId}.`);
      return { imageId, imageFileName, palette };
    }
  },
  {
    id: "art__color-swapper", action: "color-swap", title: "Color Swapper", description: "Replace a selected color in an existing URage image and return a new image artifact.",
    inputSchema: { type: "object", required: ["imageId", "imageFileName", "targetColor", "replacementColor"], properties: { imageId: { type: "string" }, imageFileName: { type: "string" }, targetColor: { type: "string" }, replacementColor: { type: "string" }, tolerance: { type: "number", minimum: 0, maximum: 442, default: 0 } } },
    async invoke(input, dependencies) {
      const imageId = requiredText(input, "imageId"); const imageFileName = requiredText(input, "imageFileName"); const targetColor = requiredText(input, "targetColor"); const replacementColor = requiredText(input, "replacementColor"); const tolerance = Number(input.tolerance ?? 0);
      if (!Number.isFinite(tolerance)) throw new ToolInvocationError(400, "tolerance must be a finite number.");
      const converted = await serverImageToolActions.colorSwap((await dependencies.readGeneratedImageFile(imageId, imageFileName)).data, targetColor, replacementColor, tolerance);
      const sourceName = path.basename(imageFileName, path.extname(imageFileName)) || "image";
      const imported = await dependencies.importGeneratedImage({ imageFileName: `${sourceName}-color-swapped.png`, imageData: converted.data, prompt: `Color swap conversion of ${imageFileName}`, width: converted.width, height: converted.height, model: "Color Swapper", metadata: { sourceTool: typeof input.__serverToolId === "string" ? input.__serverToolId : "art__color-swapper", sourceImageId: imageId, sourceImageFileName: imageFileName, targetColor, replacementColor, tolerance } });
      dependencies.runtimeState.recordAction("dashboard:color-swapper", `Color-swapped image ${imageId} to ${imported.id}.`); return imported;
    }
  },
  {
    id: "art__image-transparency-tool", action: "transparency", title: "Image Transparency Tool", description: "Adjust alpha transparency or clean low-alpha pixels in an existing URage image.",
    inputSchema: { type: "object", required: ["imageId", "imageFileName"], properties: { imageId: { type: "string" }, imageFileName: { type: "string" }, opacity: { type: "number", minimum: 0, maximum: 100, default: 100 }, alphaThreshold: { type: "number", minimum: 0, maximum: 255, default: 0 }, cleanupMode: { type: "string", enum: ["none", "transparent", "color"], default: "none" }, replacementColor: { type: "string" } } },
    async invoke(input, dependencies) {
      const imageId = requiredText(input, "imageId"); const imageFileName = requiredText(input, "imageFileName"); const opacity = Number(input.opacity ?? 100); const alphaThreshold = Number(input.alphaThreshold ?? 0); const cleanupMode = typeof input.cleanupMode === "string" ? input.cleanupMode : "none";
      if (!Number.isFinite(opacity) || !Number.isFinite(alphaThreshold) || !["none", "transparent", "color"].includes(cleanupMode)) throw new ToolInvocationError(400, "Invalid transparency options.");
      const converted = await serverImageToolActions.transparency((await dependencies.readGeneratedImageFile(imageId, imageFileName)).data, opacity, alphaThreshold, cleanupMode as "none" | "transparent" | "color", typeof input.replacementColor === "string" ? input.replacementColor : "#000000");
      const sourceName = path.basename(imageFileName, path.extname(imageFileName)) || "image"; const imported = await dependencies.importGeneratedImage({ imageFileName: `${sourceName}-transparent.png`, imageData: converted.data, prompt: `Transparency adjustment of ${imageFileName}`, width: converted.width, height: converted.height, model: "Image Transparency Tool", metadata: { sourceTool: typeof input.__serverToolId === "string" ? input.__serverToolId : "art__image-transparency-tool", sourceImageId: imageId, sourceImageFileName: imageFileName, opacity, alphaThreshold, cleanupMode } });
      dependencies.runtimeState.recordAction("dashboard:image-transparency-tool", `Adjusted transparency for image ${imageId} to ${imported.id}.`); return imported;
    }
  },
  {
    id: "art__image-crop-and-scale", action: "resize", title: "Image Crop And Scale", description: "Resize an existing URage image with cover, contain, or fill behavior.",
    inputSchema: { type: "object", required: ["imageId", "imageFileName", "width", "height"], properties: { imageId: { type: "string" }, imageFileName: { type: "string" }, width: { type: "number", minimum: 1, maximum: 4096 }, height: { type: "number", minimum: 1, maximum: 4096 }, fit: { type: "string", enum: ["cover", "contain", "fill"], default: "cover" }, background: { type: "string", default: "#00000000" } } },
    async invoke(input, dependencies) {
      const imageId = requiredText(input, "imageId"); const imageFileName = requiredText(input, "imageFileName"); const width = Number(input.width); const height = Number(input.height); const fit = typeof input.fit === "string" ? input.fit : "cover";
      if (!Number.isFinite(width) || !Number.isFinite(height) || !["cover", "contain", "fill"].includes(fit)) throw new ToolInvocationError(400, "Invalid crop-and-scale options.");
      const converted = await serverImageToolActions.resize((await dependencies.readGeneratedImageFile(imageId, imageFileName)).data, width, height, fit as "cover" | "contain" | "fill", typeof input.background === "string" ? input.background : "#00000000");
      const sourceName = path.basename(imageFileName, path.extname(imageFileName)) || "image"; const imported = await dependencies.importGeneratedImage({ imageFileName: `${sourceName}-${converted.width}x${converted.height}.png`, imageData: converted.data, prompt: `Crop and scale conversion of ${imageFileName}`, width: converted.width, height: converted.height, model: "Image Crop And Scale", metadata: { sourceTool: typeof input.__serverToolId === "string" ? input.__serverToolId : "art__image-crop-and-scale", sourceImageId: imageId, sourceImageFileName: imageFileName, fit } });
      dependencies.runtimeState.recordAction("dashboard:image-crop-and-scale", `Resized image ${imageId} to ${imported.id}.`); return imported;
    }
  },
  { id: "art__ai-image-naturalizer", action: "naturalize", title: "Ai Image Naturalizer", description: "Add deterministic subtle texture variation to an existing URage image.", inputSchema: { type: "object", required: ["imageId", "imageFileName"], properties: { imageId: { type: "string" }, imageFileName: { type: "string" }, intensity: { type: "number", minimum: 0, maximum: 32, default: 8 }, seed: { type: "number", default: 1 } } }, async invoke(input, dependencies) { const imageId=requiredText(input,"imageId"), imageFileName=requiredText(input,"imageFileName"), intensity=Number(input.intensity ?? 8), seed=Number(input.seed ?? 1); if(!Number.isFinite(intensity)||!Number.isFinite(seed)) throw new ToolInvocationError(400,"intensity and seed must be finite numbers."); const converted=await serverImageToolActions.naturalize((await dependencies.readGeneratedImageFile(imageId,imageFileName)).data,intensity,seed); const base=path.basename(imageFileName,path.extname(imageFileName))||"image"; const imported=await dependencies.importGeneratedImage({imageFileName:`${base}-naturalized.png`,imageData:converted.data,prompt:`Naturalized ${imageFileName}`,width:converted.width,height:converted.height,model:"Ai Image Naturalizer",metadata:{sourceTool:typeof input.__serverToolId === "string" ? input.__serverToolId : "art__ai-image-naturalizer",sourceImageId:imageId,sourceImageFileName:imageFileName,intensity,seed}}); dependencies.runtimeState.recordAction("dashboard:ai-image-naturalizer",`Naturalized image ${imageId} to ${imported.id}.`); return imported; } },
  { id: "art__toon-image-shader", action: "toon", title: "Toon Image Shader", description: "Create a color-quantized toon-style image from an existing URage image.", inputSchema: { type: "object", required: ["imageId", "imageFileName"], properties: { imageId: { type: "string" }, imageFileName: { type: "string" }, levels: { type: "number", minimum: 2, maximum: 32, default: 6 } } }, async invoke(input, dependencies) { const imageId=requiredText(input,"imageId"), imageFileName=requiredText(input,"imageFileName"), levels=Number(input.levels ?? 6); if(!Number.isFinite(levels)) throw new ToolInvocationError(400,"levels must be finite."); const converted=await serverImageToolActions.toon((await dependencies.readGeneratedImageFile(imageId,imageFileName)).data,levels); const base=path.basename(imageFileName,path.extname(imageFileName))||"image"; const imported=await dependencies.importGeneratedImage({imageFileName:`${base}-toon.png`,imageData:converted.data,prompt:`Toon shader conversion of ${imageFileName}`,width:converted.width,height:converted.height,model:"Toon Image Shader",metadata:{sourceTool:typeof input.__serverToolId === "string" ? input.__serverToolId : "art__toon-image-shader",sourceImageId:imageId,sourceImageFileName:imageFileName,levels}}); dependencies.runtimeState.recordAction("dashboard:toon-image-shader",`Toon-shaded image ${imageId} to ${imported.id}.`); return imported; } }
];