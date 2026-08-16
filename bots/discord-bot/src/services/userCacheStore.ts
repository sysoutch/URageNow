import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@urage/server/config/appConfig";

export interface CachedGuildUser {
  guildId: string;
  userId: string;
  username: string;
  displayName: string;
  tag: string;
  lastSeenAt: string;
}

interface StoredUserCache {
  guilds: Record<string, Record<string, CachedGuildUser>>;
}

const dataDirectory = path.resolve(appConfig.dataDirectory);
const storePath = path.join(dataDirectory, "user-cache.json");

async function ensureStoreFile(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });

  try {
    await readFile(storePath, "utf8");
  } catch {
    const initial: StoredUserCache = { guilds: {} };
    await writeFile(storePath, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<StoredUserCache> {
  await ensureStoreFile();
  const raw = await readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<StoredUserCache>;
  return {
    guilds: parsed.guilds ?? {}
  };
}

async function writeStore(store: StoredUserCache): Promise<void> {
  await ensureStoreFile();
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

function normalizeCachedUser(input: CachedGuildUser): CachedGuildUser {
  return {
    guildId: input.guildId,
    userId: input.userId,
    username: input.username.trim(),
    displayName: input.displayName.trim(),
    tag: input.tag.trim(),
    lastSeenAt: input.lastSeenAt
  };
}

function matchesQuery(user: CachedGuildUser, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [
    user.username,
    user.displayName,
    user.tag,
    user.userId
  ].some(value => value.toLowerCase().includes(normalizedQuery));
}

export async function upsertCachedGuildUser(input: CachedGuildUser): Promise<CachedGuildUser> {
  const store = await readStore();
  const normalized = normalizeCachedUser(input);
  const guildUsers = store.guilds[normalized.guildId] ?? {};
  guildUsers[normalized.userId] = normalized;
  store.guilds[normalized.guildId] = guildUsers;
  await writeStore(store);
  return normalized;
}

export async function upsertCachedGuildUsers(inputs: CachedGuildUser[]): Promise<CachedGuildUser[]> {
  if (inputs.length === 0) {
    return [];
  }

  const store = await readStore();
  const saved: CachedGuildUser[] = [];

  for (const input of inputs) {
    const normalized = normalizeCachedUser(input);
    const guildUsers = store.guilds[normalized.guildId] ?? {};
    guildUsers[normalized.userId] = normalized;
    store.guilds[normalized.guildId] = guildUsers;
    saved.push(normalized);
  }

  await writeStore(store);
  return saved;
}

export async function removeCachedGuildUser(guildId: string, userId: string): Promise<void> {
  const store = await readStore();
  const guildUsers = store.guilds[guildId];
  if (!guildUsers || !guildUsers[userId]) {
    return;
  }

  delete guildUsers[userId];
  if (Object.keys(guildUsers).length === 0) {
    delete store.guilds[guildId];
  } else {
    store.guilds[guildId] = guildUsers;
  }

  await writeStore(store);
}

export async function searchCachedGuildUsers(
  guildId: string,
  query: string,
  limit = 24
): Promise<CachedGuildUser[]> {
  const store = await readStore();
  const guildUsers = Object.values(store.guilds[guildId] ?? {});
  return guildUsers
    .filter(user => matchesQuery(user, query))
    .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt))
    .slice(0, limit);
}
