import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { appConfig } from "../../config/appConfig.js";
import { recordDashboardSystemConsoleEvent } from "../dashboardConsoleLogger.js";
import { getSharpRuntime } from "../sharpRuntime.js";
import { sanitizeFileName } from "./fileNaming.js";

export type ModelCaptureVariant = "merged" | "original" | "lowpoly" | "albedo";
export type ModelCaptureAction = "rotate" | "delight";

export interface ModelCaptureRenderInput {
  sourceModelPath: string;
  action: ModelCaptureAction;
  outputStem?: string;
  timeoutMs?: number;
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    engine?: "BLENDER_EEVEE_NEXT" | "CYCLES" | "BLENDER_WORKBENCH";
    projection?: "ORTHO" | "PERSP";
    shading?: "TEXTURE" | "MATERIAL";
    shadows?: "on" | "off";
    zoom?: number;
    rotateTarget?: "camera" | "object";
    axis?: "X" | "Y" | "Z";
    degrees?: number;
    frames?: number;
    background?: "transparent" | "solidcolor" | "skybox";
    bgColor?: string;
  };
}

export interface ModelCaptureRenderResult {
  data: Buffer;
  fileName: string;
  mimeType: "image/png" | "image/gif";
}

interface BlenderCaptureProcessResult {
  exitCode: number;
  signal: NodeJS.Signals | null;
  output: string;
}

const blenderCaptureFrameSize = 768;
const blenderRotateFrameCount = 32;
const blenderRotateFrameDelayMs = 90;

function trimProcessOutput(output: string): string {
  const normalized = String(output || "").trim();
  if (!normalized) {
    return "(no Blender output)";
  }
  return normalized.length > 4000 ? `${normalized.slice(0, 4000)}\n...(truncated)` : normalized;
}

function resolveCaptureScriptPath(action: ModelCaptureAction): string {
  return action === "delight"
    ? path.resolve(appConfig.blenderModelDelightScriptPath)
    : path.resolve(appConfig.blenderModelCaptureScriptPath);
}

function buildCaptureArgs(input: {
  sourceModelPath: string;
  outputImagePath: string;
  framesDirectoryPath: string;
  action: ModelCaptureAction;
  options?: ModelCaptureRenderInput["options"];
}): string[] {
  const isRotate = input.action === "rotate";
  const width = typeof input.options?.width === "number" && Number.isFinite(input.options.width) ? Math.max(64, Math.min(4096, Math.round(input.options.width))) : 1080;
  const height = typeof input.options?.height === "number" && Number.isFinite(input.options.height) ? Math.max(64, Math.min(4096, Math.round(input.options.height))) : 1080;
  const zoom = typeof input.options?.zoom === "number" && Number.isFinite(input.options.zoom) ? Math.max(0.01, Math.min(10, input.options.zoom)) : 1.35;
  const projection = input.options?.projection === "PERSP" ? "PERSP" : "ORTHO";
  const background = input.options?.background === "solidcolor" || input.options?.background === "skybox" ? input.options.background : "transparent";
  const bgColor = String(input.options?.bgColor || "#320000").trim() || "#320000";
  const args = [
    "--background",
    "--python",
    resolveCaptureScriptPath(input.action),
    "--",
    `--filepath=${path.resolve(input.sourceModelPath)}`,
    `--output=${path.resolve(input.outputImagePath)}`,
    `--width=${width}`,
    `--height=${height}`,
    `--background=${background}`,
    `--projection=${projection}`,
    `--zoom=${zoom}`,
    `--bg-color=${bgColor}`
  ];
  if (!isRotate) {
    return args;
  }
  const quality = typeof input.options?.quality === "number" && Number.isFinite(input.options.quality) ? Math.max(1, Math.min(100, Math.round(input.options.quality))) : 90;
  const engine = input.options?.engine === "BLENDER_EEVEE_NEXT" || input.options?.engine === "CYCLES" ? input.options.engine : "BLENDER_WORKBENCH";
  const shading = input.options?.shading === "MATERIAL" ? "MATERIAL" : "TEXTURE";
  const shadows = input.options?.shadows === "on" ? "on" : "off";
  const rotateTarget = input.options?.rotateTarget === "camera" ? "camera" : "object";
  const axis = input.options?.axis === "X" || input.options?.axis === "Y" ? input.options.axis : "Z";
  const degrees = typeof input.options?.degrees === "number" && Number.isFinite(input.options.degrees) ? Math.max(1, Math.min(3600, input.options.degrees)) : 360;
  const frames = typeof input.options?.frames === "number" && Number.isFinite(input.options.frames) ? Math.max(2, Math.min(240, Math.round(input.options.frames))) : blenderRotateFrameCount;
  args.push(`--quality=${quality}`);
  args.push(`--engine=${engine}`);
  args.push(`--shading=${shading}`);
  args.push(`--shadows=${shadows}`);
  args.push("--rotate");
  args.push(`--rotate-target=${rotateTarget}`);
  args.push(`--axis=${axis}`);
  args.push(`--degrees=${degrees}`);
  args.push(`--frames=${frames}`);
  args.push(`--gif-folder=${path.resolve(input.framesDirectoryPath)}`);
  return args;
}

function runBlenderCaptureProcess(args: string[], timeoutMs: number): Promise<BlenderCaptureProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(appConfig.blenderExecutablePath, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let settled = false;
    let output = "";
    const finish = (result: BlenderCaptureProcessResult) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      resolve(result);
    };
    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      reject(error);
    };
    const timeoutHandle = setTimeout(() => {
      try {
        child.kill();
      } catch {}
      fail(new Error(`Blender capture timed out after ${timeoutMs}ms.`));
    }, Math.max(10_000, timeoutMs));
    child.stdout.on("data", chunk => {
      const text = chunk.toString();
      output += text;
      recordDashboardSystemConsoleEvent({ source: "blender:capture:stdout", level: "info", message: text.trim() || text });
    });
    child.stderr.on("data", chunk => {
      const text = chunk.toString();
      output += text;
      recordDashboardSystemConsoleEvent({ source: "blender:capture:stderr", level: "warn", message: text.trim() || text });
    });
    child.once("error", error => {
      recordDashboardSystemConsoleEvent({ source: "blender:capture", level: "error", message: error.message });
      fail(error);
    });
    child.once("close", (exitCode, signal) => {
      finish({ exitCode: exitCode ?? -1, signal: signal ?? null, output });
    });
  });
}

async function createGifFrameBuffer(framePath: string, size: number): Promise<Buffer> {
  const sharp = getSharpRuntime();
  return sharp(framePath, { animated: false })
    .resize(size, size, { fit: "cover", position: "center" })
    .ensureAlpha()
    .raw()
    .toBuffer();
}

async function createAnimatedGifFromFrames(framePaths: string[]): Promise<Buffer> {
  const sharp = getSharpRuntime();
  const validFramePaths: string[] = [];
  let frameSize = 0;
  for (const framePath of framePaths) {
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
    throw new Error("Blender capture did not produce enough valid rotation frames.");
  }
  frameSize = Math.min(frameSize, blenderCaptureFrameSize);
  const rawFrames: Buffer[] = [];
  for (const framePath of validFramePaths) {
    rawFrames.push(await createGifFrameBuffer(framePath, frameSize));
  }
  const stacked = Buffer.concat(rawFrames);
  const delay = new Array(rawFrames.length).fill(blenderRotateFrameDelayMs);
  return sharp(stacked, {
    raw: {
      width: frameSize,
      height: frameSize * rawFrames.length,
      channels: 4,
      pageHeight: frameSize
    },
    animated: true
  }).gif({ loop: 0, delay }).toBuffer();
}

async function readRotationFramePaths(framesDirectoryPath: string): Promise<string[]> {
  const entries = await readdir(framesDirectoryPath, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && /^frame_\d+\.png$/i.test(entry.name))
    .map(entry => path.join(framesDirectoryPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

export async function renderModelCaptureWithBlender(input: ModelCaptureRenderInput): Promise<ModelCaptureRenderResult> {
  const sourceModelPath = path.resolve(input.sourceModelPath);
  const timeoutMs = typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs)
    ? Math.max(10_000, Math.round(input.timeoutMs))
    : appConfig.blenderModelCaptureTimeoutMs;
  await stat(sourceModelPath);
  const tempDirectoryPath = await mkdtemp(path.join(os.tmpdir(), "urage-model-capture-"));
  const outputStem = sanitizeFileName(String(input.outputStem || "model-capture").trim(), "model-capture");
  const outputImagePath = path.join(tempDirectoryPath, `${outputStem}.png`);
  const framesDirectoryPath = path.join(tempDirectoryPath, "frames");
  try {
    const args = buildCaptureArgs({
      sourceModelPath,
      outputImagePath,
      framesDirectoryPath,
      action: input.action,
      options: input.options
    });
    const result = await runBlenderCaptureProcess(args, timeoutMs);
    if (result.exitCode !== 0 || result.signal) {
      throw new Error(`Blender capture failed (code=${result.exitCode}, signal=${result.signal ?? "none"}).\n${trimProcessOutput(result.output)}`);
    }
    if (input.action === "rotate") {
      const framePaths = await readRotationFramePaths(framesDirectoryPath);
      const data = await createAnimatedGifFromFrames(framePaths);
      return { data, fileName: `${outputStem}.gif`, mimeType: "image/gif" };
    }
    const data = await readFile(outputImagePath);
    return { data, fileName: `${outputStem}.png`, mimeType: "image/png" };
  } finally {
    await rm(tempDirectoryPath, { recursive: true, force: true }).catch(() => undefined);
  }
}
