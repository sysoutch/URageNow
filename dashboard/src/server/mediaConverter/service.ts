import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { repoRoot } from "@urage/server/config/repositoryPaths";
import { appConfig } from "../runtime/botBridge.js";

export type MediaConverterMode = "video-to-gif" | "video-to-png-frames";

export interface MediaConvertRequest {
  sourceDataUrl: string;
  sourceFileName: string;
  mode: MediaConverterMode;
  fps?: number;
  width?: number;
}

export interface MediaConvertResult {
  jobId: string;
  mode: MediaConverterMode;
  sourceFileName: string;
  resultFileName: string | null;
  resultContentType: string | null;
  resultUrl: string | null;
  archiveFileName: string | null;
  archiveUrl: string | null;
  frameFiles: string[];
  frameUrls: string[];
}
export interface MediaConverterRecentGif {
  jobId: string;
  fileName: string;
  url: string;
  createdAt: string;
}

interface DataUrlParts {
  mimeType: string;
  data: Buffer;
  extension: string;
}

const mediaConverterRootDirectory = path.resolve(appConfig.dataDirectory, "media-converter");
const mediaConverterJobsDirectory = path.join(mediaConverterRootDirectory, "jobs");
const allowedVideoMimeTypes = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "image/gif"]);

function parseMediaDataUrl(value: string): DataUrlParts {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match || !match[1] || !match[2]) {
    throw new Error("A valid base64 media data URL is required.");
  }
  const mimeType = String(match[1]).trim().toLowerCase();
  if (!allowedVideoMimeTypes.has(mimeType)) {
    throw new Error("Unsupported media type: " + mimeType);
  }
  const data = Buffer.from(match[2], "base64");
  const extension = mimeType === "video/mp4"
    ? ".mp4"
    : mimeType === "video/webm"
      ? ".webm"
      : mimeType === "video/quicktime"
        ? ".mov"
        : mimeType === "video/x-matroska"
          ? ".mkv"
          : ".gif";
  return { mimeType, data, extension };
}

function sanitizeFileName(value: string, fallbackBaseName: string): string {
  const base = path.basename(String(value || "").trim()) || fallbackBaseName;
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+/, "").slice(0, 120);
  return cleaned || fallbackBaseName;
}

function normalizePositiveInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function buildScaleFilter(width: number): string {
  if (!Number.isFinite(width) || width <= 0) {
    return "scale=iw:ih";
  }
  return `scale=${width}:-1:flags=lanczos`;
}

function getContentTypeForFile(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".gif") return "image/gif";
  if (extension === ".png") return "image/png";
  if (extension === ".zip") return "application/zip";
  if (extension === ".mp4") return "video/mp4";
  if (extension === ".webm") return "video/webm";
  return "application/octet-stream";
}

async function ensureMediaConverterDirectories(): Promise<void> {
  await mkdir(mediaConverterJobsDirectory, { recursive: true });
}

async function runProcess(command: string, args: string[], options?: { cwd?: string; }): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd || repoRoot,
      windowsHide: true,
      env: process.env
    });
    let stderr = "";
    child.stderr?.on("data", chunk => {
      stderr += String(chunk || "");
      if (stderr.length > 8_000) {
        stderr = stderr.slice(stderr.length - 8_000);
      }
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

async function createZipArchive(archivePath: string, sourcePattern: string, workingDirectory: string): Promise<void> {
  const command = "powershell.exe";
  const script = `Compress-Archive -Path '${sourcePattern.replace(/'/g, "''")}' -DestinationPath '${archivePath.replace(/'/g, "''")}' -Force`;
  await runProcess(command, ["-NoProfile", "-NonInteractive", "-Command", script], { cwd: workingDirectory });
}

export async function convertMedia(input: MediaConvertRequest, ffmpegExecutablePath: string): Promise<MediaConvertResult> {
  await ensureMediaConverterDirectories();
  const source = parseMediaDataUrl(input.sourceDataUrl);
  const sourceFileName = sanitizeFileName(input.sourceFileName, "media-source" + source.extension);
  const fps = normalizePositiveInteger(input.fps, 12, 1, 60);
  const width = normalizePositiveInteger(input.width, 512, 64, 2048);
  const jobId = randomUUID();
  const jobDirectory = path.join(mediaConverterJobsDirectory, jobId);
  const inputDirectory = path.join(jobDirectory, "input");
  const outputDirectory = path.join(jobDirectory, "output");
  const frameDirectory = path.join(outputDirectory, "frames");
  await mkdir(inputDirectory, { recursive: true });
  await mkdir(outputDirectory, { recursive: true });
  const inputPath = path.join(inputDirectory, sourceFileName);
  await writeFile(inputPath, source.data);
  if (input.mode === "video-to-gif") {
    const palettePath = path.join(outputDirectory, "palette.png");
    const resultFileName = path.parse(sourceFileName).name + ".gif";
    const resultPath = path.join(outputDirectory, resultFileName);
    const scaleFilter = buildScaleFilter(width);
    await runProcess(ffmpegExecutablePath, [
      "-y",
      "-i",
      inputPath,
      "-vf",
      `fps=${fps},${scaleFilter},palettegen=max_colors=256`,
      palettePath
    ]);
    await runProcess(ffmpegExecutablePath, [
      "-y",
      "-i",
      inputPath,
      "-i",
      palettePath,
      "-lavfi",
      `fps=${fps},${scaleFilter}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
      resultPath
    ]);
    return {
      jobId,
      mode: input.mode,
      sourceFileName,
      resultFileName,
      resultContentType: "image/gif",
      resultUrl: `/api/media-converter-file?jobId=${encodeURIComponent(jobId)}&file=${encodeURIComponent(resultFileName)}`,
      archiveFileName: null,
      archiveUrl: null,
      frameFiles: [],
      frameUrls: []
    };
  }
  await mkdir(frameDirectory, { recursive: true });
  const scaleFilter = buildScaleFilter(width);
  await runProcess(ffmpegExecutablePath, [
    "-y",
    "-i",
    inputPath,
    "-vf",
    `fps=${fps},${scaleFilter}`,
    path.join(frameDirectory, "frame-%04d.png")
  ]);
  const frameFiles = (await readdir(frameDirectory))
    .filter(fileName => fileName.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.localeCompare(b));
  const archiveFileName = path.parse(sourceFileName).name + "-frames.zip";
  const archivePath = path.join(outputDirectory, archiveFileName);
  if (frameFiles.length > 0) {
    await createZipArchive(archivePath, "frames\\*.png", outputDirectory);
  }
  return {
    jobId,
    mode: input.mode,
    sourceFileName,
    resultFileName: null,
    resultContentType: null,
    resultUrl: null,
    archiveFileName: frameFiles.length > 0 ? archiveFileName : null,
    archiveUrl: frameFiles.length > 0 ? `/api/media-converter-file?jobId=${encodeURIComponent(jobId)}&file=${encodeURIComponent(archiveFileName)}` : null,
    frameFiles,
    frameUrls: frameFiles.map(fileName => `/api/media-converter-file?jobId=${encodeURIComponent(jobId)}&file=${encodeURIComponent(path.posix.join("frames", fileName))}`)
  };
}

export async function readMediaConverterJobFile(jobId: string, requestedFile: string): Promise<{ data: Buffer; contentType: string; }> {
  const normalizedJobId = String(jobId || "").trim();
  const normalizedFile = String(requestedFile || "").trim().replace(/\\/g, "/");
  if (!normalizedJobId || !normalizedFile) {
    throw new Error("jobId and file are required.");
  }
  const safeJobId = normalizedJobId.replace(/[^a-zA-Z0-9_-]+/g, "");
  if (safeJobId !== normalizedJobId) {
    throw new Error("Invalid job id.");
  }
  const baseDirectory = path.resolve(mediaConverterJobsDirectory, safeJobId, "output");
  const absolutePath = path.resolve(baseDirectory, normalizedFile);
  const allowedPrefix = baseDirectory.endsWith(path.sep) ? baseDirectory : `${baseDirectory}${path.sep}`;
  if (absolutePath !== baseDirectory && !absolutePath.startsWith(allowedPrefix)) {
    throw new Error("Invalid file path.");
  }
  await stat(absolutePath);
  return {
    data: await readFile(absolutePath),
    contentType: getContentTypeForFile(absolutePath)
  };
}

export async function listRecentMediaConverterGifs(limit = 24): Promise<MediaConverterRecentGif[]> {
  await ensureMediaConverterDirectories();
  const jobEntries = await readdir(mediaConverterJobsDirectory, { withFileTypes: true }).catch(() => []);
  const gifs: MediaConverterRecentGif[] = [];
  for (const entry of jobEntries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const jobId = entry.name;
    const outputDirectory = path.join(mediaConverterJobsDirectory, jobId, "output");
    const outputEntries = await readdir(outputDirectory, { withFileTypes: true }).catch(() => []);
    for (const outputEntry of outputEntries) {
      if (!outputEntry.isFile() || !outputEntry.name.toLowerCase().endsWith(".gif")) {
        continue;
      }
      const absolutePath = path.join(outputDirectory, outputEntry.name);
      const fileInfo = await stat(absolutePath).catch(() => null);
      gifs.push({
        jobId,
        fileName: outputEntry.name,
        url: `/api/media-converter-file?jobId=${encodeURIComponent(jobId)}&file=${encodeURIComponent(outputEntry.name)}`,
        createdAt: fileInfo ? fileInfo.mtime.toISOString() : new Date().toISOString()
      });
    }
  }
  return gifs
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, Math.max(1, Math.min(100, Math.round(limit))));
}

export async function cleanupMediaConverterJob(jobId: string): Promise<void> {
  const normalizedJobId = String(jobId || "").trim().replace(/[^a-zA-Z0-9_-]+/g, "");
  if (!normalizedJobId) {
    return;
  }
  const targetDirectory = path.join(mediaConverterJobsDirectory, normalizedJobId);
  await rm(targetDirectory, { recursive: true, force: true });
}
