import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../config/appConfig.js";
import { deleteImagePool, listImagePools, saveImagePool } from "./imagePoolStore.js";
import type { GeneratedAudioPublicRecord, GeneratedVideoPublicRecord } from "@urage/shared/media/generatedRecords";
import type {
  DashboardResourcePoolDetail,
  DashboardResourcePoolItem,
  DashboardResourcePoolKind,
  DashboardResourcePoolRecord
} from "@urage/shared/resourcePools/contracts";
import { listGeneratedAudiosPublic, listGeneratedVideosPublic } from "./generatedMediaLibrary.js";
import { listGeneratedModelsPublic, type GeneratedModelPublicRecord } from "./model3d.js";

type PersistedResourcePoolKind = Exclude<DashboardResourcePoolKind, "image">;

interface StoredResourcePool {
  id: string;
  kind: PersistedResourcePoolKind;
  name: string;
  entryIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface StoredResourcePoolFile {
  pools: StoredResourcePool[];
}

const dataDirectory = path.resolve(appConfig.dataDirectory);
const resourcePoolStorePath = path.join(dataDirectory, "resource-pools.json");
const legacyModel3dPoolStorePath = path.join(dataDirectory, "model3d-pools.json");

const builtInPoolMeta: Record<PersistedResourcePoolKind, { id: string; name: string }> = {
  model3d: { id: "all-generated-models", name: "All Generated Models" },
  video: { id: "all-generated-videos", name: "All Generated Videos" },
  audio: { id: "all-generated-audio", name: "All Generated Audio" },
  music: { id: "all-generated-music", name: "All Generated Music" }
};

function isPersistedResourcePoolKind(value: string): value is PersistedResourcePoolKind {
  return value === "model3d" || value === "video" || value === "audio" || value === "music";
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeUniqueStringEntries(entries: string[]): string[] {
  const unique = new Set<string>();
  const normalized: string[] = [];
  for (const entry of entries) {
    const trimmed = String(entry || "").trim();
    if (!trimmed || unique.has(trimmed)) continue;
    unique.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

function normalizeStoredResourcePool(input: Partial<StoredResourcePool>): StoredResourcePool | null {
  const id = typeof input.id === "string" ? input.id.trim() : "";
  const normalizedKind = typeof input.kind === "string" ? input.kind.trim() : "";
  const kind: PersistedResourcePoolKind | null = isPersistedResourcePoolKind(normalizedKind) ? normalizedKind : null;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!id || !kind || !name) return null;
  const createdAt = typeof input.createdAt === "string" && input.createdAt.trim() ? input.createdAt : new Date().toISOString();
  const updatedAt = typeof input.updatedAt === "string" && input.updatedAt.trim() ? input.updatedAt : createdAt;
  return {
    id,
    kind,
    name,
    entryIds: normalizeUniqueStringEntries(Array.isArray(input.entryIds) ? input.entryIds : []),
    createdAt,
    updatedAt
  };
}

async function readLegacyModel3dPoolStore(): Promise<StoredResourcePool[]> {
  try {
    const raw = await readFile(legacyModel3dPoolStorePath, "utf8");
    const parsed = JSON.parse(raw) as { pools?: Array<{ id?: unknown; name?: unknown; modelIds?: unknown; createdAt?: unknown; updatedAt?: unknown; }> };
    return Array.isArray(parsed.pools)
      ? parsed.pools.map(entry => normalizeStoredResourcePool({
        id: typeof entry.id === "string" ? entry.id : "",
        kind: "model3d",
        name: typeof entry.name === "string" ? entry.name : "",
        entryIds: Array.isArray(entry.modelIds) ? entry.modelIds.filter((value): value is string => typeof value === "string") : [],
        createdAt: typeof entry.createdAt === "string" ? entry.createdAt : "",
        updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : ""
      })).filter((entry): entry is StoredResourcePool => entry !== null)
      : [];
  } catch {
    return [];
  }
}

async function ensureResourcePoolStore(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  try {
    await readFile(resourcePoolStorePath, "utf8");
  } catch {
    const initial: StoredResourcePoolFile = { pools: await readLegacyModel3dPoolStore() };
    await writeFile(resourcePoolStorePath, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readResourcePoolStore(): Promise<StoredResourcePoolFile> {
  await ensureResourcePoolStore();
  const raw = await readFile(resourcePoolStorePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<StoredResourcePoolFile>;
  return {
    pools: Array.isArray(parsed.pools)
      ? parsed.pools.map(normalizeStoredResourcePool).filter((entry): entry is StoredResourcePool => entry !== null)
      : []
  };
}

async function writeResourcePoolStore(store: StoredResourcePoolFile): Promise<void> {
  await ensureResourcePoolStore();
  await writeFile(resourcePoolStorePath, JSON.stringify(store, null, 2), "utf8");
}

async function listStoredResourcePools(kind: PersistedResourcePoolKind): Promise<StoredResourcePool[]> {
  const store = await readResourcePoolStore();
  return store.pools
    .filter(pool => pool.kind === kind)
    .map(pool => ({ ...pool, entryIds: [...pool.entryIds] }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function buildAbsolutePoolUrl(origin: string, value: string): string {
  return new URL(value, origin).toString();
}

function extractPoolSourceFileName(source: string, fallback: string): string {
  const trimmed = String(source || "").trim();
  if (!trimmed) return fallback;
  try {
    const parsed = new URL(trimmed, "http://127.0.0.1");
    const fileName = parsed.searchParams.get("file")?.trim();
    if (fileName) return fileName.split(/[\\/]/).filter(Boolean).pop() || fallback;
    const fromPath = decodeURIComponent(parsed.pathname || "").split(/[\\/]/).filter(Boolean).pop();
    return fromPath || fallback;
  } catch {
    return trimmed.split(/[\\/]/).filter(Boolean).pop() || fallback;
  }
}

function buildImagePoolItem(source: string, origin: string, index: number): DashboardResourcePoolItem {
  const fileName = extractPoolSourceFileName(source, `pool-image-${index + 1}.png`);
  const trimmed = String(source || "").trim();
  const absoluteUrl = /^data:/i.test(trimmed) ? trimmed : buildAbsolutePoolUrl(origin, trimmed);
  return {
    id: `image-${index + 1}`,
    title: fileName,
    fileName,
    resourceKind: "image",
    sourceValue: trimmed,
    previewUrl: absoluteUrl,
    focusPreviewUrl: absoluteUrl,
    downloadUrl: absoluteUrl,
    createdAt: null
  };
}

function buildModelPoolItem(record: GeneratedModelPublicRecord, origin: string): DashboardResourcePoolItem {
  const previewSource = [
    record.previewImageUrl,
    record.lowPolyPreviewImageUrl,
    record.previewGifUrl,
    record.lowPolyPreviewGifUrl,
    ...(Array.isArray(record.multiViewUrls) ? record.multiViewUrls : [])
  ].find(value => typeof value === "string" && value.trim()) || null;
  const focusPreviewSource = [
    record.previewGifUrl,
    record.lowPolyPreviewGifUrl,
    record.previewImageUrl,
    record.lowPolyPreviewImageUrl,
    ...(Array.isArray(record.multiViewUrls) ? record.multiViewUrls : [])
  ].find(value => typeof value === "string" && value.trim()) || null;
  return {
    id: record.id,
    title: record.modelFileName,
    fileName: record.modelFileName,
    resourceKind: "model3d",
    sourceValue: record.id,
    previewUrl: previewSource ? buildAbsolutePoolUrl(origin, previewSource) : null,
    focusPreviewUrl: focusPreviewSource ? buildAbsolutePoolUrl(origin, focusPreviewSource) : null,
    downloadUrl: buildAbsolutePoolUrl(origin, record.modelUrl),
    createdAt: record.createdAt
  };
}

function buildVideoPoolItem(record: GeneratedVideoPublicRecord, origin: string): DashboardResourcePoolItem {
  const downloadUrl = buildAbsolutePoolUrl(origin, record.videoUrl);
  return {
    id: record.id,
    title: record.videoFileName,
    fileName: record.videoFileName,
    resourceKind: "video",
    sourceValue: record.id,
    previewUrl: null,
    focusPreviewUrl: downloadUrl,
    downloadUrl,
    createdAt: record.createdAt
  };
}

function buildAudioPoolItem(record: GeneratedAudioPublicRecord, origin: string, kind: "audio" | "music"): DashboardResourcePoolItem {
  const downloadUrl = buildAbsolutePoolUrl(origin, record.audioUrl);
  return {
    id: record.id,
    title: record.audioFileName,
    fileName: record.audioFileName,
    resourceKind: kind,
    sourceValue: record.id,
    previewUrl: null,
    focusPreviewUrl: downloadUrl,
    downloadUrl,
    createdAt: record.createdAt
  };
}

function toImagePoolRecord(pool: Awaited<ReturnType<typeof listImagePools>>[number]): DashboardResourcePoolRecord {
  return {
    id: pool.id,
    kind: "image",
    name: pool.name,
    itemCount: Array.isArray(pool.images) ? pool.images.length : 0,
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
    builtIn: false
  };
}

function toStoredPoolRecord(pool: StoredResourcePool): DashboardResourcePoolRecord {
  return {
    id: pool.id,
    kind: pool.kind,
    name: pool.name,
    itemCount: Array.isArray(pool.entryIds) ? pool.entryIds.length : 0,
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
    builtIn: false
  };
}

function toPoolRecord(detail: DashboardResourcePoolDetail): DashboardResourcePoolRecord {
  return {
    id: detail.id,
    kind: detail.kind,
    name: detail.name,
    itemCount: detail.itemCount,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    builtIn: detail.builtIn
  };
}

async function buildBuiltInPool(kind: PersistedResourcePoolKind, origin: string): Promise<DashboardResourcePoolDetail> {
  const meta = builtInPoolMeta[kind];
  if (kind === "model3d") {
    const models = await listGeneratedModelsPublic();
    return {
      id: meta.id,
      kind,
      name: meta.name,
      itemCount: models.length,
      createdAt: models[models.length - 1]?.createdAt || new Date().toISOString(),
      updatedAt: models[0]?.createdAt || new Date().toISOString(),
      builtIn: true,
      items: models.map(record => buildModelPoolItem(record, origin))
    };
  }
  if (kind === "video") {
    const videos = await listGeneratedVideosPublic();
    return {
      id: meta.id,
      kind,
      name: meta.name,
      itemCount: videos.length,
      createdAt: videos[videos.length - 1]?.createdAt || new Date().toISOString(),
      updatedAt: videos[0]?.createdAt || new Date().toISOString(),
      builtIn: true,
      items: videos.map(record => buildVideoPoolItem(record, origin))
    };
  }
  const audios = (await listGeneratedAudiosPublic()).filter(record => record.mode === kind);
  return {
    id: meta.id,
    kind,
    name: meta.name,
    itemCount: audios.length,
    createdAt: audios[audios.length - 1]?.createdAt || new Date().toISOString(),
    updatedAt: audios[0]?.createdAt || new Date().toISOString(),
    builtIn: true,
    items: audios.map(record => buildAudioPoolItem(record, origin, kind))
  };
}

async function buildPersistedPoolItems(kind: PersistedResourcePoolKind, entryIds: string[], origin: string): Promise<DashboardResourcePoolItem[]> {
  if (kind === "model3d") {
    const models = await listGeneratedModelsPublic();
    const recordMap = new Map(models.map(record => [record.id, record]));
    return entryIds
      .map(entryId => recordMap.get(entryId) ?? null)
      .filter((record): record is GeneratedModelPublicRecord => record !== null)
      .map(record => buildModelPoolItem(record, origin));
  }
  if (kind === "video") {
    const videos = await listGeneratedVideosPublic();
    const recordMap = new Map(videos.map(record => [record.id, record]));
    return entryIds
      .map(entryId => recordMap.get(entryId) ?? null)
      .filter((record): record is GeneratedVideoPublicRecord => record !== null)
      .map(record => buildVideoPoolItem(record, origin));
  }
  const records = (await listGeneratedAudiosPublic()).filter(record => record.mode === kind);
  const recordMap = new Map(records.map(record => [record.id, record]));
  return entryIds
    .map(entryId => recordMap.get(entryId) ?? null)
    .filter((record): record is GeneratedAudioPublicRecord => record !== null)
    .map(record => buildAudioPoolItem(record, origin, kind));
}

export async function listDashboardResourcePools(kind: DashboardResourcePoolKind): Promise<DashboardResourcePoolRecord[]> {
  if (kind === "image") {
    return (await listImagePools()).map(toImagePoolRecord);
  }
  const persisted = (await listStoredResourcePools(kind)).map(toStoredPoolRecord);
  const builtIn = await buildBuiltInPool(kind, "http://127.0.0.1");
  return [toPoolRecord(builtIn), ...persisted];
}

export async function getDashboardResourcePoolDetail(kind: DashboardResourcePoolKind, id: string, origin: string): Promise<DashboardResourcePoolDetail | null> {
  const targetId = id.trim();
  if (!targetId) return null;
  if (kind === "image") {
    const pool = (await listImagePools()).find(entry => entry.id === targetId) ?? null;
    if (!pool) return null;
    return {
      ...toImagePoolRecord(pool),
      items: (Array.isArray(pool.images) ? pool.images : []).map((source, index) => buildImagePoolItem(source, origin, index))
    };
  }
  if (targetId === builtInPoolMeta[kind].id) {
    return buildBuiltInPool(kind, origin);
  }
  const pool = (await listStoredResourcePools(kind)).find(entry => entry.id === targetId) ?? null;
  if (!pool) return null;
  return {
    ...toStoredPoolRecord(pool),
    items: await buildPersistedPoolItems(kind, pool.entryIds, origin)
  };
}

export async function saveDashboardResourcePool(input: {
  kind: DashboardResourcePoolKind;
  id?: string;
  name: string;
  entries: string[];
}): Promise<DashboardResourcePoolRecord> {
  const name = input.name.trim();
  if (!name) throw new Error("Pool name is required.");
  if (input.kind === "image") {
    const saved = await saveImagePool({
      id: input.id?.trim() || undefined,
      name,
      images: input.entries
    });
    return toImagePoolRecord(saved);
  }
  const store = await readResourcePoolStore();
  const requestedId = input.id?.trim() ?? "";
  const existing = requestedId ? store.pools.find(entry => entry.id === requestedId && entry.kind === input.kind) ?? null : null;
  const now = new Date().toISOString();
  const next: StoredResourcePool = {
    id: existing?.id ?? (requestedId || createId()),
    kind: input.kind,
    name,
    entryIds: normalizeUniqueStringEntries(input.entries),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  const index = store.pools.findIndex(entry => entry.id === next.id && entry.kind === next.kind);
  if (index === -1) store.pools.push(next);
  else store.pools[index] = next;
  await writeResourcePoolStore(store);
  return toStoredPoolRecord(next);
}

export async function deleteDashboardResourcePool(kind: DashboardResourcePoolKind, id: string): Promise<boolean> {
  const targetId = id.trim();
  if (!targetId) return false;
  if (kind === "image") {
    return deleteImagePool(targetId);
  }
  if (targetId === builtInPoolMeta[kind].id) return false;
  const store = await readResourcePoolStore();
  const before = store.pools.length;
  store.pools = store.pools.filter(entry => !(entry.kind === kind && entry.id === targetId));
  if (store.pools.length === before) return false;
  await writeResourcePoolStore(store);
  return true;
}
