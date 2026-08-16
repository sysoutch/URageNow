import { rm } from "node:fs/promises";
import path from "node:path";
import { runModelPreviewFrameRender, runModelPreviewRender } from "./lowPolyModelService.js";
import { getSharpRuntime } from "../sharpRuntime.js";
import { sanitizeFileName } from "./fileNaming.js";
import { ensureUniqueFileName } from "./fsHelpers.js";

const MODEL_PREVIEW_TURNTABLE_FRAME_COUNT = 32;
const MODEL_PREVIEW_TURNTABLE_FRAME_DELAY_MS = 90;
const MODEL_PREVIEW_MAX_FRAME_SIZE = 640;
const MULTIVIEW_PREVIEW_FRAME_DELAY_MS = 180;

async function createPreviewGifFrame(framePath: string, frameSize: number): Promise<Buffer> {
  const sharp = getSharpRuntime();
  return sharp(framePath, { animated: false })
    .resize(frameSize, frameSize, { fit: "cover", position: "center" })
    .ensureAlpha()
    .raw()
    .toBuffer();
}

async function createPreviewGifFromFramePaths(input: {
  framePaths: string[];
  modelDirectory: string;
  fileNameHint: string;
  frameDelayMs?: number;
  maxFrameSize?: number;
}): Promise<string | null> {
  if (input.framePaths.length === 0) {
    return null;
  }
  const sharp = getSharpRuntime();
  const validFramePaths: string[] = [];
  let frameSize = 0;
  for (const framePath of input.framePaths) {
    try {
      const metadata = await sharp(framePath, { animated: false }).metadata();
      if (!metadata.width || !metadata.height) {
        continue;
      }
      frameSize = Math.max(frameSize, metadata.width, metadata.height);
      validFramePaths.push(framePath);
    } catch {
      continue;
    }
  }
  if (validFramePaths.length < 2 || frameSize <= 0) {
    return null;
  }
  frameSize = Math.min(frameSize, input.maxFrameSize ?? MODEL_PREVIEW_MAX_FRAME_SIZE);
  const rawFrames: Buffer[] = [];
  for (const framePath of validFramePaths) {
    rawFrames.push(await createPreviewGifFrame(framePath, frameSize));
  }
  if (rawFrames.length < 2) {
    return null;
  }
  const stacked = Buffer.concat(rawFrames);
  const frameDelay = new Array(rawFrames.length).fill(Math.max(30, input.frameDelayMs ?? 120));
  const gifFileName = await ensureUniqueFileName(input.modelDirectory, input.fileNameHint);
  const gifPath = path.join(input.modelDirectory, gifFileName);
  await sharp(stacked, {
    raw: {
      width: frameSize,
      height: frameSize * rawFrames.length,
      channels: 4,
      pageHeight: frameSize
    },
    animated: true
  }).gif({ loop: 0, delay: frameDelay }).toFile(gifPath);
  try {
    const gifMetadata = await sharp(gifPath, { animated: true }).metadata();
    if ((gifMetadata.pages ?? 1) < 2) {
      await rm(gifPath, { force: true });
      return null;
    }
  } catch {
    return null;
  }
  return gifFileName;
}

export async function createPreviewGifFromMultiView(modelDirectory: string, multiViewFileNames: string[]): Promise<string | null> {
  if (multiViewFileNames.length === 0) {
    return null;
  }
  const sideViewFileNames = multiViewFileNames.length >= 6 ? multiViewFileNames.slice(0, -2) : multiViewFileNames;
  const candidateFileNames = sideViewFileNames.length > 0 ? sideViewFileNames : multiViewFileNames;
  const framePaths = candidateFileNames.map(fileName => path.join(modelDirectory, fileName));
  return createPreviewGifFromFramePaths({
    framePaths,
    modelDirectory,
    fileNameHint: "preview.gif",
    frameDelayMs: MULTIVIEW_PREVIEW_FRAME_DELAY_MS,
    maxFrameSize: MODEL_PREVIEW_MAX_FRAME_SIZE
  });
}

export async function renderModelPreviewMedia(input: {
  modelDirectory: string;
  modelFileName: string;
  frameCount?: number;
  frameDelayMs?: number;
}): Promise<{ previewImageFileName: string | null; previewGifFileName: string | null; }> {
  const modelPath = path.join(input.modelDirectory, input.modelFileName);
  const stem = path.basename(input.modelFileName, path.extname(input.modelFileName)) || "model";
  let previewImageFileName: string | null = null;
  let previewGifFileName: string | null = null;
  try {
    const previewDesiredName = sanitizeFileName(`${stem}_preview.png`, "model_preview.png");
    const previewOutputPath = path.join(input.modelDirectory, previewDesiredName);
    await runModelPreviewRender({
      sourceModelPath: modelPath,
      outputImagePath: previewOutputPath
    });
    previewImageFileName = path.basename(previewOutputPath);
  } catch (error) {
    console.warn("Failed to render model preview image.", error);
  }
  const framesDirectoryPath = path.join(input.modelDirectory, `${stem}_preview_frames`);
  try {
    await rm(framesDirectoryPath, { recursive: true, force: true });
    const framePaths = await runModelPreviewFrameRender({
      sourceModelPath: modelPath,
      outputDirectoryPath: framesDirectoryPath,
      frameCount: input.frameCount ?? MODEL_PREVIEW_TURNTABLE_FRAME_COUNT
    });
    previewGifFileName = await createPreviewGifFromFramePaths({
      framePaths,
      modelDirectory: input.modelDirectory,
      fileNameHint: sanitizeFileName(`${stem}_preview.gif`, "model_preview.gif"),
      frameDelayMs: input.frameDelayMs ?? MODEL_PREVIEW_TURNTABLE_FRAME_DELAY_MS,
      maxFrameSize: MODEL_PREVIEW_MAX_FRAME_SIZE
    });
  } catch (error) {
    console.warn("Failed to render model preview GIF.", error);
  }
  try {
    await rm(framesDirectoryPath, { recursive: true, force: true });
  } catch {}
  return { previewImageFileName, previewGifFileName };
}
