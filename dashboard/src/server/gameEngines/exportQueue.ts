import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../runtime/botBridge.js";

export type GameEngineId = "unity" | "unreal" | "godot";
export type GameEngineResourceKind = "text" | "image" | "gif" | "model3d" | "video" | "audio" | "music" | "file";
export type GameEngineExportStatus = "pending" | "imported" | "failed";

export interface GameEngineExportRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  engine: GameEngineId;
  sourceStudio: string;
  resourceKind: GameEngineResourceKind;
  status: GameEngineExportStatus;
  title: string;
  fileName: string;
  mimeType: string;
  sourceUrl: string;
  textContent: string;
  metadata: Record<string, string | number | boolean>;
  importerNotes: string;
}

export interface CreateGameEngineExportInput {
  engine: GameEngineId;
  sourceStudio?: string;
  resourceKind: GameEngineResourceKind;
  title?: string;
  fileName?: string;
  mimeType?: string;
  sourceUrl?: string;
  dataUrl?: string;
  publicBaseUrl?: string;
  textContent?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface GameEngineExportListenSnapshot {
  changed: boolean;
  timedOut: boolean;
  version: number;
  latestUpdatedAt: string | null;
  pendingCount: number;
}

const dataDirectory = path.resolve(appConfig.dataDirectory);
const exportsDirectory = path.join(dataDirectory, "game-engine-exports");
const exportFilesDirectory = path.join(exportsDirectory, "files");
const indexPath = path.join(exportsDirectory, "index.json");
let exportMutationQueue: Promise<unknown> = Promise.resolve();
let exportChangeVersion = 0;
let exportChangeWaiters: Array<{ resolve: () => void; timer: NodeJS.Timeout | null; }> = [];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeTextFileStem(value: string): string {
  const normalized = String(value || "").trim().replace(/[^\w.\-]+/g, "_").replace(/^_+/, "");
  return normalized.slice(0, 96) || "resource";
}

function normalizeEngine(value: unknown): GameEngineId | null {
  return value === "unity" || value === "unreal" || value === "godot" ? value : null;
}

function normalizeResourceKind(value: unknown): GameEngineResourceKind | null {
  return value === "text" || value === "image" || value === "gif" || value === "model3d" || value === "video" || value === "audio" || value === "music" || value === "file"
    ? value
    : null;
}

function normalizeStatus(value: unknown): GameEngineExportStatus | null {
  return value === "pending" || value === "imported" || value === "failed" ? value : null;
}

function normalizeMetadata(value: unknown): Record<string, string | number | boolean> {
  const source = asRecord(value);
  if (!source) {
    return {};
  }
  const normalized: Record<string, string | number | boolean> = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = String(rawKey || "").trim();
    if (!key) {
      continue;
    }
    if (typeof rawValue === "string") {
      normalized[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      normalized[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "boolean") {
      normalized[key] = rawValue;
    }
  }
  return normalized;
}

function defaultExtensionForKind(kind: GameEngineResourceKind, mimeType: string): string {
  if (kind === "text") return ".txt";
  if (kind === "gif") return ".gif";
  if (kind === "image") {
    if (mimeType.includes("jpeg")) return ".jpg";
    if (mimeType.includes("webp")) return ".webp";
    return ".png";
  }
  if (kind === "model3d") return ".glb";
  if (kind === "video") return ".mp4";
  if (kind === "audio" || kind === "music") return ".mp3";
  return ".bin";
}

function buildFallbackFileName(input: {
  title: string;
  resourceKind: GameEngineResourceKind;
  mimeType: string;
}): string {
  const extension = defaultExtensionForKind(input.resourceKind, input.mimeType);
  return sanitizeTextFileStem(input.title || input.resourceKind) + extension;
}

function sanitizeFileName(value: string, fallback: string): string {
  const raw = String(value || "").trim();
  const base = path.basename(raw || fallback);
  const cleaned = base.replace(/[^\w.\-]+/g, "_").replace(/^_+/, "").slice(0, 120);
  return cleaned || fallback;
}

function parseDataUrl(value: string): { mimeType: string; data: Buffer } | null {
  const match = String(value || "").trim().match(/^data:([^;,]+);base64,(.+)$/i);
  if (!match) {
    return null;
  }
  const mimeType = String(match[1] || "").trim().toLowerCase();
  const encoded = String(match[2] || "").trim();
  if (!mimeType || !encoded) {
    return null;
  }
  return {
    mimeType,
    data: Buffer.from(encoded, "base64")
  };
}

function buildStoredExportUrl(publicBaseUrl: string, exportId: string, fileName: string): string {
  const normalizedBaseUrl = String(publicBaseUrl || "").trim().replace(/\/+$/, "");
  const query = `exportId=${encodeURIComponent(exportId)}&file=${encodeURIComponent(fileName)}`;
  return `${normalizedBaseUrl}/api/game-engine-export-file?${query}`;
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function sanitizeRecord(value: unknown): GameEngineExportRecord | null {
  const source = asRecord(value);
  if (!source) {
    return null;
  }
  const engine = normalizeEngine(source.engine);
  const resourceKind = normalizeResourceKind(source.resourceKind);
  const status = normalizeStatus(source.status);
  if (!engine || !resourceKind || !status) {
    return null;
  }
  const title = asString(source.title) || "Imported Resource";
  const mimeType = asString(source.mimeType);
  const fallbackFileName = buildFallbackFileName({ title, resourceKind, mimeType });
  return {
    id: asString(source.id) || createId(),
    createdAt: asString(source.createdAt) || new Date().toISOString(),
    updatedAt: asString(source.updatedAt) || asString(source.createdAt) || new Date().toISOString(),
    engine,
    sourceStudio: asString(source.sourceStudio) || "studio",
    resourceKind,
    status,
    title,
    fileName: sanitizeFileName(asString(source.fileName), fallbackFileName),
    mimeType,
    sourceUrl: asString(source.sourceUrl),
    textContent: typeof source.textContent === "string" ? source.textContent : "",
    metadata: normalizeMetadata(source.metadata),
    importerNotes: asString(source.importerNotes)
  };
}

async function ensureExportsDirectory(): Promise<void> {
  await mkdir(exportsDirectory, { recursive: true });
}

async function writeStoredExportFile(input: {
  exportId: string;
  fileName: string;
  dataUrl: string;
}): Promise<{ mimeType: string; sourceUrlFileName: string }> {
  const parsed = parseDataUrl(input.dataUrl);
  if (!parsed || parsed.data.length === 0) {
    throw new Error("dataUrl must be a non-empty base64 data URL.");
  }
  const exportDirectory = path.join(exportFilesDirectory, input.exportId);
  await mkdir(exportDirectory, { recursive: true });
  const fileName = sanitizeFileName(input.fileName, "tool-resource.bin");
  await writeFile(path.join(exportDirectory, fileName), parsed.data);
  return {
    mimeType: parsed.mimeType,
    sourceUrlFileName: fileName
  };
}

async function readExportIndex(): Promise<GameEngineExportRecord[]> {
  await ensureExportsDirectory();
  try {
    const raw = await readFile(indexPath, "utf8");
    return asArray(JSON.parse(raw))
      .map(entry => sanitizeRecord(entry))
      .filter((entry): entry is GameEngineExportRecord => entry !== null)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeExportIndex(entries: GameEngineExportRecord[]): Promise<void> {
  await ensureExportsDirectory();
  await writeFile(indexPath, JSON.stringify(entries, null, 2), "utf8");
}

async function mutateExportIndex<T>(mutator: (entries: GameEngineExportRecord[]) => Promise<T>): Promise<T> {
  const run = exportMutationQueue.then(async () => {
    const entries = await readExportIndex();
    const result = await mutator(entries);
    await writeExportIndex(entries);
    notifyGameEngineExportChanged();
    return result;
  });
  exportMutationQueue = run.then(() => undefined, () => undefined);
  return run;
}

function notifyGameEngineExportChanged(): void {
  exportChangeVersion += 1;
  const waiters = exportChangeWaiters;
  exportChangeWaiters = [];
  for (const waiter of waiters) {
    if (waiter.timer) clearTimeout(waiter.timer);
    waiter.resolve();
  }
}

function buildExportListenSnapshot(entries: GameEngineExportRecord[], changed: boolean, timedOut: boolean): GameEngineExportListenSnapshot {
  const pendingEntries = entries.filter(entry => entry.status === "pending");
  return {
    changed,
    timedOut,
    version: exportChangeVersion,
    latestUpdatedAt: entries[0]?.updatedAt || null,
    pendingCount: pendingEntries.length
  };
}

async function waitForAnyGameEngineExportChange(timeoutMs: number): Promise<boolean> {
  return await new Promise(resolve => {
    const waiter = {
      resolve: () => resolve(true),
      timer: timeoutMs > 0 ? setTimeout(() => {
        exportChangeWaiters = exportChangeWaiters.filter(entry => entry !== waiter);
        resolve(false);
      }, timeoutMs) : null
    };
    exportChangeWaiters.push(waiter);
  });
}

export async function listGameEngineExports(input?: {
  engine?: GameEngineId | null;
  status?: GameEngineExportStatus | null;
  limit?: number;
}): Promise<GameEngineExportRecord[]> {
  const entries = await readExportIndex();
  const filtered = entries.filter(entry => {
    if (input?.engine && entry.engine !== input.engine) {
      return false;
    }
    if (input?.status && entry.status !== input.status) {
      return false;
    }
    return true;
  });
  const limit = typeof input?.limit === "number" && Number.isFinite(input.limit) ? Math.max(1, Math.min(500, Math.floor(input.limit))) : 200;
  return filtered.slice(0, limit);
}

export async function createGameEngineExport(input: CreateGameEngineExportInput): Promise<GameEngineExportRecord> {
  const title = asString(input.title) || "Imported Resource";
  let mimeType = asString(input.mimeType);
  const fallbackFileName = buildFallbackFileName({ title, resourceKind: input.resourceKind, mimeType });
  const id = createId();
  let fileName = sanitizeFileName(asString(input.fileName), fallbackFileName);
  let sourceUrl = asString(input.sourceUrl);
  if (!sourceUrl && asString(input.dataUrl)) {
    const stored = await writeStoredExportFile({
      exportId: id,
      fileName,
      dataUrl: asString(input.dataUrl)
    });
    fileName = stored.sourceUrlFileName;
    mimeType = mimeType || stored.mimeType;
    sourceUrl = buildStoredExportUrl(asString(input.publicBaseUrl), id, fileName);
  }
  const record: GameEngineExportRecord = {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    engine: input.engine,
    sourceStudio: asString(input.sourceStudio) || "studio",
    resourceKind: input.resourceKind,
    status: "pending",
    title,
    fileName,
    mimeType,
    sourceUrl,
    textContent: typeof input.textContent === "string" ? input.textContent : "",
    metadata: normalizeMetadata(input.metadata),
    importerNotes: ""
  };
  return await mutateExportIndex(async entries => {
    entries.unshift(record);
    return record;
  });
}

export async function readGameEngineExportFile(input: {
  exportId: string;
  fileName: string;
}): Promise<{ contentType: string; data: Buffer }> {
  const exportId = asString(input.exportId).replace(/[^\w.\-]+/g, "");
  const fileName = sanitizeFileName(asString(input.fileName), "tool-resource.bin");
  if (!exportId || !fileName) {
    throw new Error("exportId and fileName are required.");
  }
  const records = await readExportIndex();
  const record = records.find(entry => entry.id === exportId && entry.fileName === fileName) || null;
  if (!record) {
    throw new Error("Game engine export file was not found.");
  }
  return {
    contentType: record.mimeType || "application/octet-stream",
    data: await readFile(path.join(exportFilesDirectory, exportId, fileName))
  };
}

export async function updateGameEngineExportStatus(input: {
  exportId: string;
  status: GameEngineExportStatus;
  importerNotes?: string;
}): Promise<GameEngineExportRecord> {
  const exportId = asString(input.exportId);
  if (!exportId) {
    throw new Error("exportId is required.");
  }
  return await mutateExportIndex(async entries => {
    const index = entries.findIndex(entry => entry.id === exportId);
    if (index < 0) {
      throw new Error("Game engine export was not found.");
    }
    const current = entries[index];
    if (!current) {
      throw new Error("Game engine export was not found.");
    }
    const updated: GameEngineExportRecord = {
      ...current,
      status: input.status,
      updatedAt: new Date().toISOString(),
      importerNotes: asString(input.importerNotes)
    };
    entries[index] = updated;
    return updated;
  });
}

export async function listenForGameEngineExportChanges(input?: {
  engine?: GameEngineId | null;
  status?: GameEngineExportStatus | null;
  sinceVersion?: number | null;
  timeoutMs?: number;
}): Promise<GameEngineExportListenSnapshot> {
  const sinceVersion = typeof input?.sinceVersion === "number" && Number.isFinite(input.sinceVersion) ? Math.max(0, Math.floor(input.sinceVersion)) : 0;
  const timeoutMs = typeof input?.timeoutMs === "number" && Number.isFinite(input.timeoutMs) ? Math.max(1_000, Math.min(60_000, Math.floor(input.timeoutMs))) : 25_000;
  if (sinceVersion < exportChangeVersion) {
    return buildExportListenSnapshot(await listGameEngineExports({
      engine: input?.engine ?? null,
      status: input?.status ?? null,
      limit: 500
    }), true, false);
  }
  const changed = await waitForAnyGameEngineExportChange(timeoutMs);
  return buildExportListenSnapshot(await listGameEngineExports({
    engine: input?.engine ?? null,
    status: input?.status ?? null,
    limit: 500
  }), changed, !changed);
}
