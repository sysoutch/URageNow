import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "@urage/server/config/appConfig";
import { getAllCommandNames } from "./commandCatalog.js";

export interface CommandSettings {
  catalogVersion?: number;
  globalEnabledCommands: string[];
  guildEnabledCommands: Record<string, string[]>;
  guildDisabledInheritedCommands: Record<string, string[]>;
}

const commandSettingsCatalogVersion = 1;

const dataDirectory = path.resolve(appConfig.dataDirectory);
const storePath = path.join(dataDirectory, "command-settings.json");
let commandSettingsMutationQueue: Promise<unknown> = Promise.resolve();

function sanitizeCommandNameList(value: unknown): string[] {
  const knownNames = new Set(getAllCommandNames());
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value
    .filter((entry): entry is string => typeof entry === "string")
    .map(entry => entry.trim())
    .filter(entry => knownNames.has(entry)))];
}

function defaultSettings(): CommandSettings {
  return {
    catalogVersion: commandSettingsCatalogVersion,
    globalEnabledCommands: getAllCommandNames(),
    guildEnabledCommands: {},
    guildDisabledInheritedCommands: {}
  };
}

function sanitizeRecord(value: unknown): Record<string, string[]> {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const result: Record<string, string[]> = {};
  for (const [key, entries] of Object.entries(value as Record<string, unknown>)) {
    const trimmed = key.trim();
    if (!trimmed) {
      continue;
    }
    result[trimmed] = sanitizeCommandNameList(entries);
  }
  return result;
}

function sanitizeSettings(value: unknown, migrateCatalog = false): CommandSettings {
  const raw = typeof value === "object" && value !== null ? value as Partial<CommandSettings> : {};
  const defaults = defaultSettings();
  const globalEnabledCommands = sanitizeCommandNameList(raw.globalEnabledCommands ?? defaults.globalEnabledCommands);
  if (migrateCatalog && (raw.catalogVersion ?? 0) < commandSettingsCatalogVersion) {
    // `game` was introduced after unversioned settings files may already have been created.
    if (!globalEnabledCommands.includes("game")) globalEnabledCommands.push("game");
  }
  return {
    catalogVersion: commandSettingsCatalogVersion,
    globalEnabledCommands,
    guildEnabledCommands: sanitizeRecord(raw.guildEnabledCommands),
    guildDisabledInheritedCommands: sanitizeRecord(raw.guildDisabledInheritedCommands)
  };
}

async function ensureStoreFile(): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });

  try {
    await readFile(storePath, "utf8");
  } catch {
    await writeFile(storePath, JSON.stringify(defaultSettings(), null, 2), "utf8");
  }
}

export async function loadCommandSettings(): Promise<CommandSettings> {
  await ensureStoreFile();
  const raw = await readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const settings = sanitizeSettings(parsed, true);
  const parsedCatalogVersion = typeof parsed === "object" && parsed !== null
    ? (parsed as { catalogVersion?: unknown }).catalogVersion
    : undefined;
  if (parsedCatalogVersion !== commandSettingsCatalogVersion) {
    await writeFile(storePath, JSON.stringify(settings, null, 2), "utf8");
  }
  return settings;
}

export async function saveCommandSettings(settings: CommandSettings): Promise<CommandSettings> {
  const sanitized = sanitizeSettings(settings);
  const task = commandSettingsMutationQueue.then(async () => {
    await ensureStoreFile();
    await writeFile(storePath, JSON.stringify(sanitized, null, 2), "utf8");
  });
  commandSettingsMutationQueue = task.catch(() => undefined);
  await task;
  return sanitized;
}

export function isCommandEnabledForGuild(settings: CommandSettings, guildId: string | null | undefined, commandName: string): boolean {
  if (!guildId) {
    return settings.globalEnabledCommands.includes(commandName);
  }

  const guildDisabled = settings.guildDisabledInheritedCommands[guildId] ?? [];
  if (guildDisabled.includes(commandName)) {
    return false;
  }

  const guildEnabled = settings.guildEnabledCommands[guildId] ?? [];
  return guildEnabled.includes(commandName) || settings.globalEnabledCommands.includes(commandName);
}
