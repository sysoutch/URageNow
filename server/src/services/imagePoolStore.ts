import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ImagePool } from "@urage/shared/resourcePools/imagePoolContracts";
import { appConfig } from "../config/appConfig.js";

interface StoredImagePools {
  pools: ImagePool[];
}

const dataDirectory = path.resolve(appConfig.dataDirectory);
const storePath = path.join(dataDirectory, "image-pools.json");

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function normalizeImagePoolEntries(images: string[]): string[] {
  const unique = new Set<string>();
  const normalized: string[] = [];
  for (const image of images) {
    const parts = String(image || "").split(/\r?\n/);
    for (const part of parts) {
      const value = part.trim();
      if (!value || unique.has(value)) continue;
      unique.add(value);
      normalized.push(value);
    }
  }
  return normalized;
}

function normalizePool(input: Partial<ImagePool>): ImagePool | null {
  const id = typeof input.id === "string" ? input.id.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const images = normalizeImagePoolEntries(Array.isArray(input.images) ? input.images : []);
  const createdAt = typeof input.createdAt === "string" && input.createdAt.trim()
    ? input.createdAt
    : new Date().toISOString();
  const updatedAt = typeof input.updatedAt === "string" && input.updatedAt.trim()
    ? input.updatedAt
    : createdAt;
  if (!id || !name) return null;
  return { id, name, images, createdAt, updatedAt };
}

async function ensureStoreFile(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  try {
    await readFile(storePath, "utf8");
  } catch {
    const initial: StoredImagePools = { pools: [] };
    await writeFile(storePath, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<StoredImagePools> {
  await ensureStoreFile();
  const raw = await readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<StoredImagePools>;
  const pools = Array.isArray(parsed.pools)
    ? parsed.pools.map(normalizePool).filter((entry): entry is ImagePool => Boolean(entry))
    : [];
  return { pools };
}

async function writeStore(store: StoredImagePools): Promise<void> {
  await ensureStoreFile();
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function listImagePools(): Promise<ImagePool[]> {
  const store = await readStore();
  return store.pools
    .map(pool => ({ ...pool, images: [...pool.images] }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function getImagePoolById(id: string): Promise<ImagePool | null> {
  const targetId = id.trim();
  if (!targetId) return null;
  const store = await readStore();
  const pool = store.pools.find(entry => entry.id === targetId);
  if (!pool) return null;
  return { ...pool, images: [...pool.images] };
}

export async function getImagePoolEntries(id: string): Promise<string[]> {
  const pool = await getImagePoolById(id);
  return pool ? [...pool.images] : [];
}

export async function saveImagePool(input: { id?: string; name: string; images: string[]; }): Promise<ImagePool> {
  const name = input.name.trim();
  if (!name) throw new Error("Image pool name is required.");
  const images = normalizeImagePoolEntries(input.images);
  const store = await readStore();
  const now = new Date().toISOString();
  const requestedId = input.id?.trim() ?? "";
  const existing = requestedId ? store.pools.find(entry => entry.id === requestedId) ?? null : null;
  const next: ImagePool = {
    id: existing?.id ?? (requestedId || createId()),
    name,
    images,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  const index = store.pools.findIndex(entry => entry.id === next.id);
  if (index === -1) store.pools.push(next);
  else store.pools[index] = next;
  await writeStore(store);
  return next;
}

export async function deleteImagePool(id: string): Promise<boolean> {
  const targetId = id.trim();
  if (!targetId) return false;
  const store = await readStore();
  const before = store.pools.length;
  store.pools = store.pools.filter(entry => entry.id !== targetId);
  if (store.pools.length === before) return false;
  await writeStore(store);
  return true;
}
