import path from "node:path";
import { getSharpRuntime } from "@urage/server/services/sharpRuntime";
import type { ManifestActionContext } from "./serverToolActionDispatcher.js";
import { ToolInvocationError } from "./toolInvocationError.js";

function requiredText(input: Record<string, unknown>, key: string): string {
  const value = typeof input[key] === "string" ? input[key].trim() : "";
  if (!value) throw new ToolInvocationError(400, `${key} is required.`);
  return value;
}

/**
 * Produces a deterministic mirrored 2×2 tile. It is deliberately separate
 * from the interactive client editor: the browser-only noise mask and 3D
 * preview do not have a reproducible headless contract.
 */
export async function createMirroredSeamlessTexture({ manifest, input, dependencies }: ManifestActionContext): Promise<unknown> {
  const imageId = requiredText(input, "imageId");
  const imageFileName = requiredText(input, "imageFileName");
  const source = await dependencies.readGeneratedImageFile(imageId, imageFileName);
  const sharp = getSharpRuntime();
  const normalized = sharp(source.data, { animated: false }).rotate();
  const metadata = await normalized.metadata();
  const width = Number(metadata.width ?? 0);
  const height = Number(metadata.height ?? 0);
  if (!width || !height || width > 4096 || height > 4096) {
    throw new ToolInvocationError(400, "The source image dimensions are unsupported for seamless texture generation.");
  }
  const halfWidth = Math.ceil(width / 2);
  const halfHeight = Math.ceil(height / 2);
  const tile = await normalized.resize(halfWidth, halfHeight, { fit: "fill" }).png().toBuffer();
  const imageData = await sharp({
    create: { width: halfWidth * 2, height: halfHeight * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  }).composite([
    { input: await sharp(tile).flip().flop().png().toBuffer(), left: 0, top: 0 },
    { input: await sharp(tile).flip().png().toBuffer(), left: halfWidth, top: 0 },
    { input: await sharp(tile).flop().png().toBuffer(), left: 0, top: halfHeight },
    { input: tile, left: halfWidth, top: halfHeight }
  ]).png().toBuffer();
  const sourceName = path.basename(imageFileName, path.extname(imageFileName)) || "texture";
  const imported = await dependencies.importGeneratedImage({
    imageFileName: `${sourceName}-seamless.png`,
    imageData,
    prompt: `Mirrored seamless texture generated from ${imageFileName}`,
    width: halfWidth * 2,
    height: halfHeight * 2,
    model: manifest.title,
    metadata: { sourceTool: manifest.id, sourceImageId: imageId, sourceImageFileName: imageFileName, mode: "mirror" }
  });
  dependencies.runtimeState.recordAction("dashboard:seamless-texture-maker", `Generated mirrored seamless texture ${imported.id} from image ${imageId}.`);
  return imported;
}
