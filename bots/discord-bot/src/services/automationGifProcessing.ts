import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@urage/server/config/appConfig";
import { createStoredZipArchive } from "./zipArchive.js";

export type GifPlaybackMode = "loop" | "pingpong";

export interface GifFrameTransformInput {
  data: Buffer;
  fileName: string;
  index: number;
}

export interface GifFrameTransformResult {
  data: Buffer;
  fileName?: string;
}

const automationGifDirectory = path.resolve(appConfig.dataDirectory, "automation-gif-processing");

function normalizePositiveInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function sanitizeFileName(value: string, fallback: string): string {
  const base = path.basename(String(value || "").trim()) || fallback;
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+/, "").slice(0, 120);
  return cleaned || fallback;
}

async function runProcess(command: string, args: string[], options?: { cwd?: string; }): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd || process.cwd(),
      windowsHide: true,
      env: process.env
    });
    let stderr = "";
    child.stderr?.on("data", chunk => {
      stderr += String(chunk || "");
      if (stderr.length > 8_000) stderr = stderr.slice(stderr.length - 8_000);
    });
    child.once("error", reject);
    child.once("close", exitCode => {
      if (exitCode === 0) {
        resolve();
        return;
      }
      reject(new Error((stderr || `Process exited with code ${exitCode ?? "unknown"}.`).trim()));
    });
  });
}

function buildScaleFilter(width: number): string {
  return Number.isFinite(width) && width > 0 ? `scale=${width}:-1:flags=lanczos` : "scale=iw:ih";
}

function createJobId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeGifPlaybackMode(value: unknown): GifPlaybackMode {
  return value === "pingpong" ? "pingpong" : "loop";
}

function buildGifFrameSequence<T>(frames: T[], playbackMode: GifPlaybackMode): T[] {
  if (playbackMode !== "pingpong" || frames.length <= 2) {
    return frames;
  }
  return [...frames, ...frames.slice(1, -1).reverse()];
}

export async function convertVideoFileToGif(input: {
  videoPath: string;
  sourceFileName: string;
  ffmpegExecutablePath: string;
  fps?: number;
  width?: number;
}): Promise<{ data: Buffer; fileName: string; }> {
  const fps = normalizePositiveInteger(input.fps, 12, 1, 60);
  const width = normalizePositiveInteger(input.width, 512, 64, 2048);
  const jobDirectory = path.join(automationGifDirectory, createJobId());
  const outputDirectory = path.join(jobDirectory, "output");
  await mkdir(outputDirectory, { recursive: true });
  try {
    const safeSourceName = sanitizeFileName(input.sourceFileName, "automation-video.mp4");
    const stem = path.basename(safeSourceName, path.extname(safeSourceName)) || "automation-video";
    const palettePath = path.join(outputDirectory, "palette.png");
    const resultFileName = sanitizeFileName(`${stem}.gif`, "automation-video.gif");
    const resultPath = path.join(outputDirectory, resultFileName);
    const scaleFilter = buildScaleFilter(width);
    await runProcess(input.ffmpegExecutablePath, [
      "-y", "-i", input.videoPath, "-vf", `fps=${fps},${scaleFilter},palettegen=max_colors=256`, palettePath
    ]);
    await runProcess(input.ffmpegExecutablePath, [
      "-y", "-i", input.videoPath, "-i", palettePath, "-lavfi", `fps=${fps},${scaleFilter}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`, resultPath
    ]);
    return {
      data: await readFile(resultPath),
      fileName: resultFileName
    };
  } finally {
    await rm(jobDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function transformGifFrames(input: {
  gifData: Buffer;
  sourceFileName: string;
  outputSuffix: string;
  ffmpegExecutablePath: string;
  playbackMode?: GifPlaybackMode;
  fps?: number;
  width?: number;
  transforms: Array<(frame: GifFrameTransformInput) => Promise<GifFrameTransformResult>>;
}): Promise<{ data: Buffer; fileName: string; frameCount: number; framesZipData: Buffer; framesZipFileName: string; }> {
  const fps = normalizePositiveInteger(input.fps, 12, 1, 60);
  const width = normalizePositiveInteger(input.width, 512, 64, 2048);
  const playbackMode = normalizeGifPlaybackMode(input.playbackMode);
  const jobDirectory = path.join(automationGifDirectory, createJobId());
  const frameDirectory = path.join(jobDirectory, "frames");
  const processedDirectory = path.join(jobDirectory, "processed");
  const sequenceDirectory = path.join(jobDirectory, "sequence");
  await mkdir(frameDirectory, { recursive: true });
  await mkdir(processedDirectory, { recursive: true });
  await mkdir(sequenceDirectory, { recursive: true });
  try {
    const sourceFileName = sanitizeFileName(input.sourceFileName, "automation.gif");
    const sourcePath = path.join(jobDirectory, sourceFileName);
    await writeFile(sourcePath, input.gifData);
    await runProcess(input.ffmpegExecutablePath, [
      "-y", "-i", sourcePath, "-vf", `fps=${fps},${buildScaleFilter(width)}`, path.join(frameDirectory, "frame-%04d.png")
    ]);
    const frameFiles = (await readdir(frameDirectory)).filter(fileName => fileName.toLowerCase().endsWith(".png")).sort((a, b) => a.localeCompare(b));
    if (frameFiles.length === 0) {
      throw new Error("No GIF frames were extracted for processing.");
    }
    for (let index = 0; index < frameFiles.length; index++) {
      const frameFileName = frameFiles[index] || `frame-${index + 1}.png`;
      let frameData = Buffer.from(await readFile(path.join(frameDirectory, frameFileName)));
      for (const transform of input.transforms) {
        const transformed = await transform({ data: frameData, fileName: frameFileName, index });
        frameData = Buffer.from(transformed.data);
      }
      await writeFile(path.join(processedDirectory, frameFileName), frameData);
    }
    const processedFrameEntries = await Promise.all(frameFiles.map(async frameFileName => ({
      name: frameFileName,
      data: await readFile(path.join(processedDirectory, frameFileName))
    })));
    const sequenceFrames = buildGifFrameSequence(processedFrameEntries, playbackMode);
    for (let index = 0; index < sequenceFrames.length; index += 1) {
      const frame = sequenceFrames[index];
      if (!frame) {
        continue;
      }
      const sequenceName = `frame-${String(index + 1).padStart(4, "0")}.png`;
      await writeFile(path.join(sequenceDirectory, sequenceName), frame.data);
    }
    const stem = path.basename(sourceFileName, path.extname(sourceFileName)) || "automation";
    const suffix = sanitizeFileName(input.outputSuffix, "processed").replace(/^\.+|\.+$/g, "") || "processed";
    const resultFileName = sanitizeFileName(`${stem}-${suffix}.gif`, "automation-processed.gif");
    const framesZipFileName = sanitizeFileName(`${stem}-${suffix}-frames.zip`, "automation-processed-frames.zip");
    const resultPath = path.join(jobDirectory, resultFileName);
    await runProcess(input.ffmpegExecutablePath, [
      "-y", "-framerate", String(fps), "-i", path.join(sequenceDirectory, "frame-%04d.png"),
      "-lavfi", "split[s0][s1];[s0]palettegen=reserve_transparent=1:transparency_color=ffffff[p];[s1][p]paletteuse=alpha_threshold=128",
      "-loop", "0", resultPath
    ]);
    return {
      data: await readFile(resultPath),
      fileName: resultFileName,
      frameCount: sequenceFrames.length,
      framesZipData: createStoredZipArchive(processedFrameEntries),
      framesZipFileName
    };
  } finally {
    await rm(jobDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
