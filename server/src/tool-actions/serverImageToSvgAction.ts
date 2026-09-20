import { createRequire } from "node:module";
import path from "node:path";
import { toolsRoot } from "@urage/server/config/repositoryPaths";
import { getSharpRuntime } from "@urage/server/services/sharpRuntime";
import type { ManifestActionContext } from "./serverToolActionDispatcher.js";
import { ToolInvocationError } from "./toolInvocationError.js";
import { saveToolArtifact } from "./toolArtifactStore.js";

type ImageTracer = {
  imagedataToSVG(imageData: { width: number; height: number; data: Buffer }, options: Record<string, unknown>): string;
};

const require = createRequire(import.meta.url);

function requiredText(input: Record<string, unknown>, key: string): string {
  const value = typeof input[key] === "string" ? input[key].trim() : "";
  if (!value) throw new ToolInvocationError(400, `${key} is required.`);
  return value;
}

function boundedNumber(input: Record<string, unknown>, key: string, fallback: number, minimum: number, maximum: number): number {
  if (input[key] === undefined) return fallback;
  const value = Number(input[key]);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new ToolInvocationError(400, `${key} must be between ${minimum} and ${maximum}.`);
  }
  return value;
}

function imageTracer(): ImageTracer {
  const implementationPath = path.join(toolsRoot, "art", "image-to-svg-converter", "imagetracer_v1.2.6.js");
  return require(implementationPath) as ImageTracer;
}

export async function createSvgFromImage({ manifest, input, dependencies }: ManifestActionContext): Promise<unknown> {
  const imageId = requiredText(input, "imageId");
  const imageFileName = requiredText(input, "imageFileName");
  const source = await dependencies.readGeneratedImageFile(imageId, imageFileName);
  const sharp = getSharpRuntime();
  const normalized = await sharp(source.data, { animated: false }).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = Number(normalized.info.width ?? 0);
  const height = Number(normalized.info.height ?? 0);
  if (!width || !height || width * height > 1_048_576) {
    throw new ToolInvocationError(400, "Source image must contain no more than 1,048,576 pixels for SVG tracing.");
  }
  const smoothing = boundedNumber(input, "smoothing", 1, 0.1, 8);
  const colors = Math.round(boundedNumber(input, "colors", 16, 2, 64));
  const svg = imageTracer().imagedataToSVG(
    { width, height, data: normalized.data },
    { ltres: smoothing, qtres: smoothing, numberofcolors: colors, pathomit: 8, blurradius: 0.5, strokewidth: 0.5, linefilter: true, viewbox: true }
  );
  if (!svg.trim().startsWith("<svg")) throw new ToolInvocationError(500, "Image tracing did not produce SVG output.");
  const fileName = `${path.basename(imageFileName, path.extname(imageFileName)) || "image"}-vector.svg`;
  const artifact = await saveToolArtifact({
    sourceToolId: manifest.id,
    fileName,
    mimeType: "image/svg+xml",
    data: svg,
    metadata: { sourceImageId: imageId, sourceImageFileName: imageFileName, width, height, colors, smoothing }
  });  dependencies.runtimeState.recordAction("dashboard:image-to-svg-converter", `Traced image ${imageId} to SVG using ${colors} colors.`);
  return { artifact, width, height, colors, smoothing, sourceTool: manifest.id };
}
