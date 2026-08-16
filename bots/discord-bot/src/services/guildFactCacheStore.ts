import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@urage/server/config/appConfig";

export interface CachedGuildFactRecord {
  guildId: string;
  key: string;
  value: string;
  checkedAt: string;
}

interface StoredGuildFactCache {
  guilds: Record<string, Record<string, CachedGuildFactRecord>>;
}

const dataDirectory = path.resolve(appConfig.dataDirectory);
const storePath = path.join(dataDirectory, "guild-fact-cache.json");
let guildFactCacheMutationQueue: Promise<unknown> = Promise.resolve();

async function ensureStoreFile(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });

  try {
    await readFile(storePath, "utf8");
  } catch {
    const initial: StoredGuildFactCache = { guilds: {} };
    await writeFile(storePath, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<StoredGuildFactCache> {
  await ensureStoreFile();
  const raw = await readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<StoredGuildFactCache>;
  return {
    guilds: parsed.guilds ?? {}
  };
}

async function writeStore(store: StoredGuildFactCache): Promise<void> {
  await ensureStoreFile();
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function getCachedGuildFact(
  guildId: string,
  key: string
): Promise<CachedGuildFactRecord | null> {
  const store = await readStore();
  return store.guilds[guildId]?.[key] ?? null;
}

export async function upsertCachedGuildFact(
  input: CachedGuildFactRecord
): Promise<CachedGuildFactRecord> {
  const record: CachedGuildFactRecord = {
    guildId: input.guildId.trim(),
    key: input.key.trim(),
    value: input.value.trim(),
    checkedAt: input.checkedAt
  };

  const task = guildFactCacheMutationQueue.then(async () => {
    const store = await readStore();
    const guildFacts = store.guilds[record.guildId] ?? {};
    guildFacts[record.key] = record;
    store.guilds[record.guildId] = guildFacts;
    await writeStore(store);
  });

  guildFactCacheMutationQueue = task.catch(() => undefined);
  await task;
  return record;
}
