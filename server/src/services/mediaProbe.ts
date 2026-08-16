import path from "node:path";
import { appConfig } from "../config/appConfig.js";
import type {
  ProbeGeneratedMediaInput,
  RustAudioProbe,
  RustImageProbe,
  RustMediaFileFact,
  RustMediaKind,
  RustMediaProbeResult,
  RustVideoProbe
} from "@urage/shared/media/probeContracts";
import { asArray, asRecord, asString, parseJsonWithOptionalBom } from "./model3d/primitives.js";
import { resolveRustWorkerLaunch, runRustWorkerCli } from "./model3d/rustWorkerRunner.js";
import {
  resolveGeneratedAudioFilePath,
  resolveGeneratedImageFilePath,
  resolveGeneratedVideoFilePath
} from "./generatedMediaLibrary.js";
export type {
  ProbeGeneratedMediaInput,
  RustAudioProbe,
  RustImageProbe,
  RustMediaFileFact,
  RustMediaKind,
  RustMediaProbeResult,
  RustVideoProbe
} from "@urage/shared/media/probeContracts";

function asNonNegativeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

function normalizeMediaKind(value: unknown): RustMediaKind {
  const normalized = asString(value)?.toLowerCase();
  return normalized === "image" || normalized === "audio" || normalized === "video" || normalized === "model3d"
    ? normalized
    : "unknown";
}

function getMediaProbeExecutableName(): string {
  return process.platform === "win32" ? "media-probe.exe" : "media-probe";
}

function normalizeMediaProbeResult(inputPath: string, value: unknown): RustMediaProbeResult {
  const raw = asRecord(value);
  const file = asRecord(raw?.file);
  const image = asRecord(raw?.image);
  const audio = asRecord(raw?.audio);
  const video = asRecord(raw?.video);
  return {
    inputPath: asString(raw?.inputPath) || inputPath,
    file: {
      exists: Boolean(file?.exists),
      extension: asString(file?.extension),
      fileName: asString(file?.fileName),
      sizeBytes: asNonNegativeNumber(file?.sizeBytes)
    },
    kind: normalizeMediaKind(raw?.kind),
    probed: Boolean(raw?.probed),
    parser: asString(raw?.parser),
    image: image ? {
      width: asNonNegativeNumber(image.width) ?? 0,
      height: asNonNegativeNumber(image.height) ?? 0,
      colorType: asString(image.colorType) || "unknown",
      hasAlpha: Boolean(image.hasAlpha),
      animated: Boolean(image.animated),
      frameCount: asNonNegativeNumber(image.frameCount)
    } : null,
    audio: audio ? {
      codec: asString(audio.codec) || "unknown",
      durationSeconds: asNonNegativeNumber(audio.durationSeconds),
      channelCount: asNonNegativeNumber(audio.channelCount),
      sampleRateHz: asNonNegativeNumber(audio.sampleRateHz),
      bitsPerSample: asNonNegativeNumber(audio.bitsPerSample)
    } : null,
    video: video ? {
      codec: asString(video.codec) || "unknown",
      container: asString(video.container) || "video",
      durationSeconds: asNonNegativeNumber(video.durationSeconds),
      trackCount: asNonNegativeNumber(video.trackCount),
      frameCount: asNonNegativeNumber(video.frameCount),
      averageFrameRate: asNonNegativeNumber(video.averageFrameRate)
    } : null,
    warnings: asArray(raw?.warnings).map(entry => asString(entry)).filter((entry): entry is string => entry !== null)
  };
}

async function resolveMediaProbeLaunch(): Promise<{ command: string; args: string[]; cwd?: string }> {
  const workspacePath = path.resolve(appConfig.rustWorkerWorkspacePath);
  return resolveRustWorkerLaunch({
    workspacePath,
    executableCandidates: [
      appConfig.rustMediaProbeExecutablePath,
      path.join(workspacePath, "target", "debug", getMediaProbeExecutableName()),
      path.join(workspacePath, "target", "release", getMediaProbeExecutableName())
    ],
    cargoExecutablePath: appConfig.cargoExecutablePath,
    crateName: "media-probe"
  });
}

export async function probeFileWithRust(inputPath: string): Promise<RustMediaProbeResult> {
  const absoluteInputPath = path.resolve(inputPath);
  const launch = await resolveMediaProbeLaunch();
  const rawOutput = await runRustWorkerCli({
    command: launch.command,
    args: [...launch.args, "--input", absoluteInputPath],
    cwd: launch.cwd
  });
  return normalizeMediaProbeResult(absoluteInputPath, parseJsonWithOptionalBom<unknown>(rawOutput));
}

export async function probeGeneratedMediaAssetWithRust(input: ProbeGeneratedMediaInput): Promise<RustMediaProbeResult> {
  const fileName = input.fileName.trim();
  if (!fileName) {
    throw new Error("fileName is required for media probing.");
  }
  if (input.assetKind === "image") {
    const imageId = String(input.imageId || "").trim();
    if (!imageId) throw new Error("imageId is required for image probing.");
    return probeFileWithRust(await resolveGeneratedImageFilePath(imageId, fileName));
  }
  if (input.assetKind === "audio") {
    const audioId = String(input.audioId || "").trim();
    if (!audioId) throw new Error("audioId is required for audio probing.");
    return probeFileWithRust(await resolveGeneratedAudioFilePath(audioId, fileName));
  }
  const videoId = String(input.videoId || "").trim();
  if (!videoId) throw new Error("videoId is required for video probing.");
  return probeFileWithRust(await resolveGeneratedVideoFilePath(videoId, fileName));
}
