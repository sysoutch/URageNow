import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../config/appConfig.js";
import type {
  GeneratedAudioPublicRecord,
  GeneratedAudioRecord,
  GeneratedImagePublicRecord,
  GeneratedImageRecord,
  GeneratedVideoPublicRecord,
  GeneratedVideoRecord
} from "@urage/shared/media/generatedRecords";
export type {
  GeneratedAudioPublicRecord,
  GeneratedAudioRecord,
  GeneratedImagePublicRecord,
  GeneratedImageRecord,
  GeneratedVideoPublicRecord,
  GeneratedVideoRecord
} from "@urage/shared/media/generatedRecords";
import { ensureUniqueFileName } from "./model3d/fsHelpers.js";
import { sanitizeFileName } from "./model3d/fileNaming.js";

const dataDirectory = path.resolve(appConfig.dataDirectory);
const generatedImagesDirectory = path.join(dataDirectory, "generated-images");
const generatedAudioDirectory = path.join(dataDirectory, "generated-audio");
const generatedVideoDirectory = path.join(dataDirectory, "generated-video");
const generatedImageIndexPath = path.join(generatedImagesDirectory, "index.json");
const generatedAudioIndexPath = path.join(generatedAudioDirectory, "index.json");
const generatedVideoIndexPath = path.join(generatedVideoDirectory, "index.json");
let generatedImageMutationQueue: Promise<unknown> = Promise.resolve();
let generatedAudioMutationQueue: Promise<unknown> = Promise.resolve();
let generatedVideoMutationQueue: Promise<unknown> = Promise.resolve();

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asPositiveInteger(value: unknown): number | null {
  const numeric = typeof value === "string" ? Number.parseInt(value.trim(), 10) : (typeof value === "number" && Number.isFinite(value) ? value : null);
  if (numeric === null || !Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.round(numeric);
}

function asNonNegativeInteger(value: unknown): number | null {
  const numeric = typeof value === "string" ? Number.parseInt(value.trim(), 10) : (typeof value === "number" && Number.isFinite(value) ? value : null);
  if (numeric === null || !Number.isFinite(numeric) || numeric < 0) {
    return null;
  }
  return Math.round(numeric);
}

function asPositiveNumber(value: unknown): number | null {
  const numeric = typeof value === "string" ? Number.parseFloat(value.trim()) : (typeof value === "number" && Number.isFinite(value) ? value : null);
  return numeric !== null && Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function sanitizeMetadata(value: unknown): Record<string, string | number | boolean> | undefined {
  const raw = asRecord(value);
  if (!raw) return undefined;
  const metadata: Record<string, string | number | boolean> = {};
  for (const [key, entry] of Object.entries(raw)) {
    const safeKey = key.trim();
    if (!safeKey) continue;
    if (typeof entry === "string") {
      metadata[safeKey] = entry.slice(0, 2000);
    } else if (typeof entry === "number" && Number.isFinite(entry)) {
      metadata[safeKey] = entry;
    } else if (typeof entry === "boolean") {
      metadata[safeKey] = entry;
    }
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function extensionToImageContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".bmp") return "image/bmp";
  if (ext === ".tiff" || ext === ".tif") return "image/tiff";
  return "application/octet-stream";
}

function extensionToAudioContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".flac") return "audio/flac";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".webm") return "audio/webm";
  if (ext === ".mp4" || ext === ".m4v") return "video/mp4";
  if (ext === ".mov") return "video/quicktime";
  return "application/octet-stream";
}

function extensionToVideoContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".mp4" || ext === ".m4v") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".avi") return "video/x-msvideo";
  if (ext === ".mkv") return "video/x-matroska";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

async function ensureStoreDirectory(directory: string, indexPath: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  try {
    await readFile(indexPath, "utf8");
  } catch {
    await writeFile(indexPath, JSON.stringify([], null, 2), "utf8");
  }
}

async function ensureUniqueArtifactId(directory: string, desiredId?: string | null): Promise<string> {
  const normalizedDesiredId = sanitizeFileName(String(desiredId || "").trim(), "");
  const requestedId = normalizedDesiredId || createId();
  const knownIds = new Set((await statDirectoryIds(directory)));
  if (!knownIds.has(requestedId)) {
    return requestedId;
  }
  let candidate = requestedId;
  let counter = 1;
  while (knownIds.has(candidate)) {
    candidate = `${requestedId}_${counter}`;
    counter += 1;
  }
  return candidate;
}

async function statDirectoryIds(directory: string): Promise<string[]> {
  try {
    const entries = await readFile(path.join(directory, "index.json"), "utf8");
    const parsed = JSON.parse(entries) as unknown;
    return asArray(parsed)
      .map(entry => asString(asRecord(entry)?.id))
      .filter((entry): entry is string => entry !== null);
  } catch {
    return [];
  }
}

function buildPublicImageFileUrl(imageId: string, fileName: string): string {
  return `/api/generated-image-file?imageId=${encodeURIComponent(imageId)}&file=${encodeURIComponent(fileName)}`;
}

function buildPublicAudioFileUrl(audioId: string, fileName: string): string {
  return `/api/generated-audio-file?audioId=${encodeURIComponent(audioId)}&file=${encodeURIComponent(fileName)}`;
}

function buildPublicVideoFileUrl(videoId: string, fileName: string): string {
  return `/api/generated-video-file?videoId=${encodeURIComponent(videoId)}&file=${encodeURIComponent(fileName)}`;
}

function sanitizeGeneratedImageRecord(value: unknown): GeneratedImageRecord | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const id = asString(raw.id);
  const createdAt = asString(raw.createdAt);
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  const comfyPromptId = asString(raw.comfyPromptId);
  const generationDurationSeconds = asPositiveNumber(raw.generationDurationSeconds);
  const imageFileName = asString(raw.imageFileName);
  const seed = asNonNegativeInteger(raw.seed);
  const steps = asPositiveInteger(raw.steps);
  const cfg = asPositiveNumber(raw.cfg);
  const width = asPositiveInteger(raw.width);
  const height = asPositiveInteger(raw.height);
  const model = asString(raw.model) ?? appConfig.comfyUiImageModelName;
  const modelGeneratedAt = typeof raw.modelGeneratedAt === "string" ? raw.modelGeneratedAt : null;
  const modelGeneratedModelId = typeof raw.modelGeneratedModelId === "string" ? raw.modelGeneratedModelId : null;
  const metadata = sanitizeMetadata(raw.metadata);
  if (!id || !createdAt || !comfyPromptId || !imageFileName || seed === null) {
    return null;
  }
  return { id, createdAt, prompt, ...(description ? { description } : {}), comfyPromptId, generationDurationSeconds, imageFileName, seed, steps, cfg, width, height, model, modelGeneratedAt, modelGeneratedModelId, ...(metadata ? { metadata } : {}) };
}

function sanitizeGeneratedAudioRecord(value: unknown): GeneratedAudioRecord | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const id = asString(raw.id);
  const createdAt = asString(raw.createdAt);
  const mode = raw.mode === "music" ? "music" : "audio";
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const tags = typeof raw.tags === "string" ? raw.tags : "";
  const lyrics = typeof raw.lyrics === "string" ? raw.lyrics : "";
  const seconds = asPositiveInteger(raw.seconds);
  const comfyPromptId = asString(raw.comfyPromptId);
  const audioFileName = asString(raw.audioFileName);
  const seed = asNonNegativeInteger(raw.seed);
  const steps = asPositiveInteger(raw.steps);
  const cfg = typeof raw.cfg === "number" && Number.isFinite(raw.cfg) && raw.cfg >= 0 ? raw.cfg : null;
  const model = asString(raw.model) ?? (mode === "music" ? appConfig.comfyUiMusicModelName : appConfig.comfyUiAudioModelName);
  if (!id || !createdAt || !comfyPromptId || !audioFileName || seed === null) {
    return null;
  }
  return { id, createdAt, mode, prompt, tags, lyrics, seconds, comfyPromptId, audioFileName, seed, steps, cfg, model };
}

function sanitizeGeneratedVideoRecord(value: unknown): GeneratedVideoRecord | null {
  const raw = asRecord(value);
  if (!raw) return null;
  const id = asString(raw.id);
  const createdAt = asString(raw.createdAt);
  const prompt = typeof raw.prompt === "string" ? raw.prompt : "";
  const seconds = asPositiveInteger(raw.seconds);
  const comfyPromptId = asString(raw.comfyPromptId);
  const generationDurationSeconds = asPositiveNumber(raw.generationDurationSeconds);
  const videoFileName = asString(raw.videoFileName);
  const seed = asNonNegativeInteger(raw.seed);
  const steps = asPositiveInteger(raw.steps);
  const model = asString(raw.model) ?? appConfig.comfyUiVideoModelName;
  if (!id || !createdAt || !comfyPromptId || !videoFileName || seed === null) {
    return null;
  }
  return { id, createdAt, prompt, seconds, comfyPromptId, generationDurationSeconds, videoFileName, seed, steps, model };
}

async function readImageIndex(): Promise<GeneratedImageRecord[]> {
  await ensureStoreDirectory(generatedImagesDirectory, generatedImageIndexPath);
  const raw = await readFile(generatedImageIndexPath, "utf8");
  return asArray(JSON.parse(raw) as unknown).map(entry => sanitizeGeneratedImageRecord(entry)).filter((entry): entry is GeneratedImageRecord => entry !== null).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function readAudioIndex(): Promise<GeneratedAudioRecord[]> {
  await ensureStoreDirectory(generatedAudioDirectory, generatedAudioIndexPath);
  const raw = await readFile(generatedAudioIndexPath, "utf8");
  return asArray(JSON.parse(raw) as unknown).map(entry => sanitizeGeneratedAudioRecord(entry)).filter((entry): entry is GeneratedAudioRecord => entry !== null).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function readVideoIndex(): Promise<GeneratedVideoRecord[]> {
  await ensureStoreDirectory(generatedVideoDirectory, generatedVideoIndexPath);
  const raw = await readFile(generatedVideoIndexPath, "utf8");
  return asArray(JSON.parse(raw) as unknown).map(entry => sanitizeGeneratedVideoRecord(entry)).filter((entry): entry is GeneratedVideoRecord => entry !== null).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

async function writeImageIndex(entries: GeneratedImageRecord[]): Promise<void> {
  const task = generatedImageMutationQueue.then(async () => {
    await ensureStoreDirectory(generatedImagesDirectory, generatedImageIndexPath);
    await writeFile(generatedImageIndexPath, JSON.stringify(entries, null, 2), "utf8");
  });
  generatedImageMutationQueue = task.catch(() => undefined);
  await task;
}

async function writeAudioIndex(entries: GeneratedAudioRecord[]): Promise<void> {
  const task = generatedAudioMutationQueue.then(async () => {
    await ensureStoreDirectory(generatedAudioDirectory, generatedAudioIndexPath);
    await writeFile(generatedAudioIndexPath, JSON.stringify(entries, null, 2), "utf8");
  });
  generatedAudioMutationQueue = task.catch(() => undefined);
  await task;
}

async function writeVideoIndex(entries: GeneratedVideoRecord[]): Promise<void> {
  const task = generatedVideoMutationQueue.then(async () => {
    await ensureStoreDirectory(generatedVideoDirectory, generatedVideoIndexPath);
    await writeFile(generatedVideoIndexPath, JSON.stringify(entries, null, 2), "utf8");
  });
  generatedVideoMutationQueue = task.catch(() => undefined);
  await task;
}

export function toGeneratedImagePublicRecord(record: GeneratedImageRecord): GeneratedImagePublicRecord {
  return { ...record, imageUrl: buildPublicImageFileUrl(record.id, record.imageFileName) };
}

export function toGeneratedAudioPublicRecord(record: GeneratedAudioRecord): GeneratedAudioPublicRecord {
  return { ...record, audioUrl: buildPublicAudioFileUrl(record.id, record.audioFileName) };
}

export function toGeneratedVideoPublicRecord(record: GeneratedVideoRecord): GeneratedVideoPublicRecord {
  return { ...record, videoUrl: buildPublicVideoFileUrl(record.id, record.videoFileName) };
}

export async function listGeneratedImages(): Promise<GeneratedImageRecord[]> {
  return readImageIndex();
}

export async function listGeneratedImagesPublic(): Promise<GeneratedImagePublicRecord[]> {
  return (await listGeneratedImages()).map(toGeneratedImagePublicRecord);
}

export async function getGeneratedImagePublicById(imageId: string): Promise<GeneratedImagePublicRecord | null> {
  const safeImageId = sanitizeFileName(imageId, "");
  if (!safeImageId) return null;
  const record = (await listGeneratedImages()).find(entry => entry.id === safeImageId);
  return record ? toGeneratedImagePublicRecord(record) : null;
}

export async function persistGeneratedImageArtifact(input: {
  record: Omit<GeneratedImageRecord, "id" | "imageFileName">;
  imageData: Buffer;
  desiredFileName: string;
  desiredId?: string | null;
}): Promise<GeneratedImageRecord> {
  if (input.imageData.length === 0) {
    throw new Error("Generated image payload is empty.");
  }
  await ensureStoreDirectory(generatedImagesDirectory, generatedImageIndexPath);
  const imageId = await ensureUniqueArtifactId(generatedImagesDirectory, input.desiredId);
  const imageDirectory = path.join(generatedImagesDirectory, imageId);
  await mkdir(imageDirectory, { recursive: true });
  const imageFileName = await ensureUniqueFileName(imageDirectory, input.desiredFileName);
  await writeFile(path.join(imageDirectory, imageFileName), input.imageData);
  const record: GeneratedImageRecord = { ...input.record, id: imageId, imageFileName };
  const existing = await readImageIndex();
  await writeImageIndex([record, ...existing.filter(entry => entry.id !== record.id)].slice(0, 500));
  return record;
}

export async function importGeneratedImageArtifact(input: { record: GeneratedImageRecord; imageData: Buffer; }): Promise<GeneratedImageRecord> {
  const sanitizedRecord = sanitizeGeneratedImageRecord(input.record);
  if (!sanitizedRecord) {
    throw new Error("Remote generated image record is invalid.");
  }
  return persistGeneratedImageArtifact({
    record: {
      createdAt: sanitizedRecord.createdAt,
      prompt: sanitizedRecord.prompt,
      ...(sanitizedRecord.description ? { description: sanitizedRecord.description } : {}),
      comfyPromptId: sanitizedRecord.comfyPromptId,
      generationDurationSeconds: sanitizedRecord.generationDurationSeconds,
      seed: sanitizedRecord.seed,
      steps: sanitizedRecord.steps,
      cfg: sanitizedRecord.cfg,
      width: sanitizedRecord.width,
      height: sanitizedRecord.height,
      model: sanitizedRecord.model,
      modelGeneratedAt: sanitizedRecord.modelGeneratedAt,
      modelGeneratedModelId: sanitizedRecord.modelGeneratedModelId,
      ...(sanitizedRecord.metadata ? { metadata: sanitizedRecord.metadata } : {})
    },
    imageData: input.imageData,
    desiredFileName: sanitizedRecord.imageFileName,
    desiredId: sanitizedRecord.id
  });
}

async function resolveGeneratedImageFilePathFromDisk(safeImageId: string, safeFileName: string): Promise<string> {
  const absolutePath = path.join(generatedImagesDirectory, safeImageId, safeFileName);
  await stat(absolutePath);
  return absolutePath;
}

export async function resolveGeneratedImageFilePath(imageId: string, fileName: string): Promise<string> {
  const safeImageId = sanitizeFileName(imageId, "");
  const safeFileName = sanitizeFileName(fileName, "");
  if (!safeImageId || !safeFileName) {
    throw new Error("Invalid generated image file request.");
  }
  const record = (await readImageIndex()).find(entry => entry.id === safeImageId);
  if (!record || safeFileName !== record.imageFileName) {
    return resolveGeneratedImageFilePathFromDisk(safeImageId, safeFileName);
  }
  return resolveGeneratedImageFilePathFromDisk(safeImageId, safeFileName);
}

export async function readGeneratedImageFile(imageId: string, fileName: string): Promise<{ data: Buffer; contentType: string }> {
  const absolutePath = await resolveGeneratedImageFilePath(imageId, fileName);
  return { data: await readFile(absolutePath), contentType: extensionToImageContentType(fileName) };
}

export async function deleteGeneratedImage(imageId: string): Promise<boolean> {
  const safeImageId = sanitizeFileName(imageId, "");
  if (!safeImageId) throw new Error("Invalid generated image delete request.");
  const images = await readImageIndex();
  const image = images.find(entry => entry.id === safeImageId);
  if (!image) return false;
  await writeImageIndex(images.filter(entry => entry.id !== safeImageId));
  await rm(path.join(generatedImagesDirectory, safeImageId), { recursive: true, force: true });
  return true;
}

export async function renameGeneratedImageFileName(imageId: string, nextFileName: string): Promise<GeneratedImageRecord> {
  const safeImageId = sanitizeFileName(imageId, "");
  const desiredRawName = sanitizeFileName(nextFileName, "");
  if (!safeImageId || !desiredRawName) throw new Error("Invalid generated image rename request.");
  const images = await readImageIndex();
  const image = images.find(entry => entry.id === safeImageId);
  if (!image) throw new Error("Generated image entry was not found.");
  const currentExtension = path.extname(image.imageFileName) || ".png";
  const desiredExtension = path.extname(desiredRawName);
  const desiredWithExtension = desiredExtension ? desiredRawName : `${path.basename(desiredRawName, path.extname(desiredRawName))}${currentExtension}`;
  const imageDirectory = path.join(generatedImagesDirectory, safeImageId);
  const nextUniqueFileName = await ensureUniqueFileName(imageDirectory, desiredWithExtension);
  if (nextUniqueFileName === image.imageFileName) {
    return image;
  }
  await rename(path.join(imageDirectory, image.imageFileName), path.join(imageDirectory, nextUniqueFileName));
  const updatedRecord: GeneratedImageRecord = { ...image, imageFileName: nextUniqueFileName };
  await writeImageIndex(images.map(entry => entry.id === safeImageId ? updatedRecord : entry));
  return updatedRecord;
}

export async function updateGeneratedImageDescription(imageId: string, description: string): Promise<GeneratedImageRecord> {
  const safeImageId = sanitizeFileName(imageId, "");
  if (!safeImageId) throw new Error("Invalid generated image description request.");
  const images = await readImageIndex();
  const image = images.find(entry => entry.id === safeImageId);
  if (!image) throw new Error("Generated image entry was not found.");
  const normalizedDescription = description.trim();
  const updatedRecord: GeneratedImageRecord = normalizedDescription
    ? { ...image, description: normalizedDescription }
    : { ...image, description: undefined };
  await writeImageIndex(images.map(entry => entry.id === safeImageId ? updatedRecord : entry));
  return updatedRecord;
}

export async function markGeneratedImageModelResult(imageId: string, modelId: string): Promise<GeneratedImageRecord> {
  const safeImageId = sanitizeFileName(imageId, "");
  const safeModelId = sanitizeFileName(modelId, "");
  if (!safeImageId || !safeModelId) throw new Error("Invalid generated image model link request.");
  const images = await readImageIndex();
  const image = images.find(entry => entry.id === safeImageId);
  if (!image) throw new Error("Generated image entry was not found.");
  const updatedRecord: GeneratedImageRecord = { ...image, modelGeneratedAt: new Date().toISOString(), modelGeneratedModelId: safeModelId };
  await writeImageIndex(images.map(entry => entry.id === safeImageId ? updatedRecord : entry));
  return updatedRecord;
}

export async function listGeneratedAudios(): Promise<GeneratedAudioRecord[]> {
  return readAudioIndex();
}

export async function listGeneratedAudiosPublic(): Promise<GeneratedAudioPublicRecord[]> {
  return (await listGeneratedAudios()).map(toGeneratedAudioPublicRecord);
}

export async function persistGeneratedAudioArtifact(input: {
  record: Omit<GeneratedAudioRecord, "id" | "audioFileName">;
  audioData: Buffer;
  desiredFileName: string;
  desiredId?: string | null;
}): Promise<GeneratedAudioRecord> {
  if (input.audioData.length === 0) {
    throw new Error("Generated audio payload is empty.");
  }
  await ensureStoreDirectory(generatedAudioDirectory, generatedAudioIndexPath);
  const audioId = await ensureUniqueArtifactId(generatedAudioDirectory, input.desiredId);
  const audioDirectory = path.join(generatedAudioDirectory, audioId);
  await mkdir(audioDirectory, { recursive: true });
  const audioFileName = await ensureUniqueFileName(audioDirectory, input.desiredFileName);
  await writeFile(path.join(audioDirectory, audioFileName), input.audioData);
  const record: GeneratedAudioRecord = { ...input.record, id: audioId, audioFileName };
  const existing = await readAudioIndex();
  await writeAudioIndex([record, ...existing.filter(entry => entry.id !== record.id)].slice(0, 500));
  return record;
}

export async function resolveGeneratedAudioFilePath(audioId: string, fileName: string): Promise<string> {
  const safeAudioId = sanitizeFileName(audioId, "");
  const safeFileName = sanitizeFileName(fileName, "");
  if (!safeAudioId || !safeFileName) throw new Error("Invalid generated audio file request.");
  const record = (await readAudioIndex()).find(entry => entry.id === safeAudioId);
  if (!record) throw new Error("Generated audio entry was not found.");
  if (record.audioFileName !== safeFileName) throw new Error("Requested file is not part of this audio artifact.");
  const absolutePath = path.join(generatedAudioDirectory, safeAudioId, safeFileName);
  await stat(absolutePath);
  return absolutePath;
}

export async function readGeneratedAudioFile(audioId: string, fileName: string): Promise<{ data: Buffer; contentType: string }> {
  const absolutePath = await resolveGeneratedAudioFilePath(audioId, fileName);
  return { data: await readFile(absolutePath), contentType: extensionToAudioContentType(fileName) };
}

export async function deleteGeneratedAudio(audioId: string): Promise<boolean> {
  const safeAudioId = sanitizeFileName(audioId, "");
  if (!safeAudioId) throw new Error("Invalid generated audio delete request.");
  const records = await readAudioIndex();
  if (!records.some(entry => entry.id === safeAudioId)) return false;
  await writeAudioIndex(records.filter(entry => entry.id !== safeAudioId));
  await rm(path.join(generatedAudioDirectory, safeAudioId), { recursive: true, force: true });
  return true;
}

export async function listGeneratedVideos(): Promise<GeneratedVideoRecord[]> {
  return readVideoIndex();
}

export async function listGeneratedVideosPublic(): Promise<GeneratedVideoPublicRecord[]> {
  return (await listGeneratedVideos()).map(toGeneratedVideoPublicRecord);
}

export async function persistGeneratedVideoArtifact(input: {
  record: Omit<GeneratedVideoRecord, "id" | "videoFileName">;
  videoData: Buffer;
  desiredFileName: string;
  desiredId?: string | null;
}): Promise<GeneratedVideoRecord> {
  if (input.videoData.length === 0) {
    throw new Error("Generated video payload is empty.");
  }
  await ensureStoreDirectory(generatedVideoDirectory, generatedVideoIndexPath);
  const videoId = await ensureUniqueArtifactId(generatedVideoDirectory, input.desiredId);
  const videoDirectory = path.join(generatedVideoDirectory, videoId);
  await mkdir(videoDirectory, { recursive: true });
  const videoFileName = await ensureUniqueFileName(videoDirectory, input.desiredFileName);
  await writeFile(path.join(videoDirectory, videoFileName), input.videoData);
  const record: GeneratedVideoRecord = { ...input.record, id: videoId, videoFileName };
  const existing = await readVideoIndex();
  await writeVideoIndex([record, ...existing.filter(entry => entry.id !== record.id)].slice(0, 500));
  return record;
}

export async function resolveGeneratedVideoFilePath(videoId: string, fileName: string): Promise<string> {
  const safeVideoId = sanitizeFileName(videoId, "");
  const safeFileName = sanitizeFileName(fileName, "");
  if (!safeVideoId || !safeFileName) throw new Error("Invalid generated video file request.");
  const record = (await readVideoIndex()).find(entry => entry.id === safeVideoId);
  if (!record) throw new Error("Generated video entry was not found.");
  if (record.videoFileName !== safeFileName) throw new Error("Requested file is not part of this video artifact.");
  const absolutePath = path.join(generatedVideoDirectory, safeVideoId, safeFileName);
  await stat(absolutePath);
  return absolutePath;
}

export async function readGeneratedVideoFile(videoId: string, fileName: string): Promise<{ data: Buffer; contentType: string }> {
  const absolutePath = await resolveGeneratedVideoFilePath(videoId, fileName);
  return { data: await readFile(absolutePath), contentType: extensionToVideoContentType(fileName) };
}

export async function deleteGeneratedVideo(videoId: string): Promise<boolean> {
  const safeVideoId = sanitizeFileName(videoId, "");
  if (!safeVideoId) throw new Error("Invalid generated video delete request.");
  const records = await readVideoIndex();
  if (!records.some(entry => entry.id === safeVideoId)) return false;
  await writeVideoIndex(records.filter(entry => entry.id !== safeVideoId));
  await rm(path.join(generatedVideoDirectory, safeVideoId), { recursive: true, force: true });
  return true;
}
