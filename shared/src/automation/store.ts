import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataRoot } from "../runtime/repositoryPaths.js";
import { normalizeAction, normalizeScheduledAutomation, normalizeTargetMessenger } from "./defaults.js";
import type { JoinAutomation, ScheduledAutomation } from "./types.js";

interface StoredAutomations {
  scheduled: ScheduledAutomation[];
  joinFollowUps: JoinAutomation[];
}

const dataDirectory = path.resolve(process.env.DASHBOARD_DATA_DIR?.trim() || dataRoot);
const storePath = path.join(dataDirectory, "automations.json");

function createId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function ensureStoreFile(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });
  try {
    await readFile(storePath, "utf8");
  } catch {
    const initial: StoredAutomations = { scheduled: [], joinFollowUps: [] };
    await writeFile(storePath, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<StoredAutomations> {
  await ensureStoreFile();
  const raw = await readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<StoredAutomations>;
  return {
    scheduled: parsed.scheduled ?? [],
    joinFollowUps: parsed.joinFollowUps ?? []
  };
}

async function writeStore(store: StoredAutomations): Promise<void> {
  await ensureStoreFile();
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function listScheduledAutomations(guildId: string): Promise<ScheduledAutomation[]> {
  const store = await readStore();
  return store.scheduled
    .filter(entry => entry.guildId === guildId)
    .map(normalizeScheduledAutomation)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function listAllScheduledAutomations(): Promise<ScheduledAutomation[]> {
  const store = await readStore();
  return store.scheduled.map(normalizeScheduledAutomation);
}

export async function saveScheduledAutomation(
  input: Omit<ScheduledAutomation, "id" | "createdAt" | "lastRunAt"> & { id?: string; createdAt?: string; lastRunAt?: string | null }
): Promise<ScheduledAutomation> {
  const store = await readStore();
  const existing = input.id ? store.scheduled.find(entry => entry.id === input.id) : null;
  const next: ScheduledAutomation = {
    id: input.id?.trim() || createId(),
    guildId: input.guildId,
    name: input.name.trim(),
    enabled: input.enabled,
    targetMessenger: normalizeTargetMessenger(input.targetMessenger),
    channelId: String(input.channelId || "").trim(),
    triggerMode: input.triggerMode === "interval" ? "interval" : "cron",
    cron: input.cron.trim(),
    intervalValue: Math.max(1, Math.floor(input.intervalValue || 1)),
    intervalUnit: input.intervalUnit ?? "days",
    repeatCount: Math.max(1, Math.floor(input.repeatCount || 1)),
    repeatDelaySeconds: Math.max(0, Math.floor(input.repeatDelaySeconds || 0)),
    action: normalizeAction(input.action),
    createdAt: existing?.createdAt ?? input.createdAt ?? new Date().toISOString(),
    lastRunAt: input.lastRunAt ?? null
  };
  const index = store.scheduled.findIndex(entry => entry.id === next.id);
  if (index === -1) {
    store.scheduled.push(next);
  } else {
    store.scheduled[index] = next;
  }
  await writeStore(store);
  return next;
}

export async function deleteScheduledAutomation(id: string): Promise<boolean> {
  const store = await readStore();
  const before = store.scheduled.length;
  store.scheduled = store.scheduled.filter(entry => entry.id !== id);
  if (store.scheduled.length === before) {
    return false;
  }
  await writeStore(store);
  return true;
}

export async function markScheduledAutomationRun(id: string, executedAt: string): Promise<void> {
  const store = await readStore();
  const entry = store.scheduled.find(item => item.id === id);
  if (!entry) {
    return;
  }
  entry.lastRunAt = executedAt;
  await writeStore(store);
}

export async function listJoinAutomations(guildId: string): Promise<JoinAutomation[]> {
  const store = await readStore();
  return store.joinFollowUps
    .filter(entry => entry.guildId === guildId)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function saveJoinAutomation(input: Omit<JoinAutomation, "id"> & { id?: string }): Promise<JoinAutomation> {
  const store = await readStore();
  const next: JoinAutomation = {
    id: input.id?.trim() || createId(),
    guildId: input.guildId,
    name: input.name.trim(),
    enabled: input.enabled,
    channelId: input.channelId,
    delaySeconds: Math.max(0, Math.floor(input.delaySeconds)),
    action: normalizeAction(input.action)
  };
  const index = store.joinFollowUps.findIndex(entry => entry.id === next.id);
  if (index === -1) {
    store.joinFollowUps.push(next);
  } else {
    store.joinFollowUps[index] = next;
  }
  await writeStore(store);
  return next;
}

export async function deleteJoinAutomation(id: string): Promise<boolean> {
  const store = await readStore();
  const before = store.joinFollowUps.length;
  store.joinFollowUps = store.joinFollowUps.filter(entry => entry.id !== id);
  if (store.joinFollowUps.length === before) {
    return false;
  }
  await writeStore(store);
  return true;
}
