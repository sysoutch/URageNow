import path from "node:path";
import { getSharpRuntime } from "@urage/server/services/sharpRuntime";
import type { ManifestActionContext } from "./serverToolActionDispatcher.js";
import { saveToolArtifact } from "./toolArtifactStore.js";
import { ToolInvocationError } from "./toolInvocationError.js";

type OutputFormat = "png" | "jpeg" | "webp";

function requiredText(input: Record<string, unknown>, key: string): string {
  const value = typeof input[key] === "string" ? input[key].trim() : "";
  if (!value) throw new ToolInvocationError(400, `${key} is required.`);
  return value;
}

function gridDimension(input: Record<string, unknown>, key: string): number {
  const value = Number(input[key]);
  if (!Number.isInteger(value) || value < 1 || value > 8) {
    throw new ToolInvocationError(400, `${key} must be an integer from 1 to 8.`);
  }
  return value;
}

function outputFormat(input: Record<string, unknown>): OutputFormat {
  const value = input.format === undefined ? "png" : String(input.format);
  if (value !== "png" && value !== "jpeg" && value !== "webp") {
    throw new ToolInvocationError(400, "format must be png, jpeg, or webp.");
  }
  return value;
}

function outputQuality(input: Record<string, unknown>): number {
  if (input.quality === undefined) return 92;
  const value = Number(input.quality);
  if (!Number.isFinite(value) || value < 10 || value > 100) {
    throw new ToolInvocationError(400, "quality must be between 10 and 100.");
  }
  return Math.round(value);
}

async function renderTile(data: Buffer, format: OutputFormat, quality: number): Promise<Buffer> {
  if (format === "png") return data;
  const image = getSharpRuntime()(data);
  return format === "jpeg" ? image.jpeg({ quality }).toBuffer() : image.webp({ quality }).toBuffer();
}

export async function sliceSpritesheetGrid({ manifest, input, dependencies }: ManifestActionContext): Promise<unknown> {
  const imageId = requiredText(input, "imageId");
  const imageFileName = requiredText(input, "imageFileName");
  const columns = gridDimension(input, "columns");
  const rows = gridDimension(input, "rows");
  if (columns * rows > 64) throw new ToolInvocationError(400, "The grid cannot contain more than 64 sprites.");
  const format = outputFormat(input);
  const quality = outputQuality(input);
  const source = await dependencies.readGeneratedImageFile(imageId, imageFileName);
  const sharp = getSharpRuntime();
  const normalized = sharp(source.data, { animated: false }).rotate();
  const metadata = await normalized.metadata();
  const sourceWidth = Number(metadata.width ?? 0);
  const sourceHeight = Number(metadata.height ?? 0);
  if (!sourceWidth || !sourceHeight || sourceWidth > 8192 || sourceHeight > 8192) {
    throw new ToolInvocationError(400, "The source image dimensions are unsupported for this tool.");
  }
  const cellWidth = Math.floor(sourceWidth / columns);
  const cellHeight = Math.floor(sourceHeight / rows);
  if (!cellWidth || !cellHeight) throw new ToolInvocationError(400, "The selected grid does not leave a usable sprite size.");
  const baseName = path.basename(imageFileName, path.extname(imageFileName)) || "spritesheet";
  const extension = format === "jpeg" ? "jpg" : format;
  const sprites: Array<{ id: string; imageFileName: string; row: number; column: number; x: number; y: number; width: number; height: number }> = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * cellWidth;
      const y = row * cellHeight;
      const extracted = await sharp(source.data, { animated: false }).rotate().extract({ left: x, top: y, width: cellWidth, height: cellHeight }).png().toBuffer();
      const imageData = await renderTile(extracted, format, quality);
      const imported = await dependencies.importGeneratedImage({
        imageFileName: `${baseName}-${row + 1}-${column + 1}.${extension}`,
        imageData,
        prompt: `Sprite ${row + 1},${column + 1} split from ${imageFileName}`,
        width: cellWidth,
        height: cellHeight,
        model: manifest.title,
        metadata: { sourceTool: manifest.id, sourceImageId: imageId, sourceImageFileName: imageFileName, row: row + 1, column: column + 1, rows, columns, format }
      });
      sprites.push({ ...imported, row: row + 1, column: column + 1, x, y, width: cellWidth, height: cellHeight });
    }
  }
  const atlas = { version: 1, sourceImageId: imageId, sourceImageFileName: imageFileName, sourceWidth, sourceHeight, columns, rows, cellWidth, cellHeight, sprites };
  const artifact = await saveToolArtifact({
    sourceToolId: manifest.id,
    fileName: `${baseName}-atlas.json`,
    mimeType: "application/json",
    data: JSON.stringify(atlas, null, 2),
    metadata: { sourceImageId: imageId, columns, rows, spriteCount: sprites.length }
  });
  dependencies.runtimeState.recordAction("dashboard:spritesheet-utility", `Split image ${imageId} into ${sprites.length} regular grid sprites.`);
  return { ...atlas, artifact };
}
