import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../../config/appConfig.js";
import { repoRoot } from "../../config/repositoryPaths.js";
import { resolveTypingTextConfig } from "./typingSpeedTextConfig.js";
import { resolveRacingRosterConfig } from "./racingRosterConfig.js";
import { resolveUltimateTexasHoldemConfig } from "./ultimateTexasHoldemConfig.js";

export const supportedGameRuntimes = ["discord", "telegram", "matrix", "whatsapp"] as const;
export type GameRuntimeId = typeof supportedGameRuntimes[number];
export type GameTypeId = "typing-speed" | "animal-racing" | "ultimate-texas-holdem";
const gameTypeRuntimes: Record<GameTypeId, readonly GameRuntimeId[]> = {
  "typing-speed": ["discord"],
  "animal-racing": ["discord"],
  "ultimate-texas-holdem": ["discord"]
};

export type GamePackageManifest = {
  id: string;
  name: string;
  description: string;
  version: string;
  runtimes: GameRuntimeId[];
  gameType: GameTypeId;
};

export type GamePackageDocument = {
  manifest: GamePackageManifest;
  configuration: Record<string, unknown>;
};

export type InstalledGamePackage = GamePackageManifest & {
  enabledRuntimes: GameRuntimeId[];
};

type GameCatalog = { schemaVersion: 1; games: InstalledGamePackage[] };

const MAX_GAME_PACKAGE_BYTES = 128 * 1024;
const gameDataRoot = path.resolve(appConfig.dataDirectory, "games");
const gamePackagesRoot = path.join(gameDataRoot, "packages");
const gameCatalogPath = path.join(gameDataRoot, "catalog.json");
const bundledGamesRoot = path.resolve(repoRoot, "bots", "discord-bot", "game-packs");
let catalogQueue: Promise<unknown> = Promise.resolve();

function isRuntime(value: unknown): value is GameRuntimeId {
  return typeof value === "string" && (supportedGameRuntimes as readonly string[]).includes(value);
}

function isGameType(value: unknown): value is GameTypeId {
  return typeof value === "string" && Object.keys(gameTypeRuntimes).includes(value);
}

function validateManifest(value: unknown): GamePackageManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Game manifest must be an object.");
  const manifest = value as Record<string, unknown>;
  const id = typeof manifest.id === "string" ? manifest.id.trim() : "";
  const name = typeof manifest.name === "string" ? manifest.name.trim() : "";
  const description = typeof manifest.description === "string" ? manifest.description.trim() : "";
  const version = typeof manifest.version === "string" ? manifest.version.trim() : "";
  const gameType = isGameType(manifest.gameType) ? manifest.gameType as GameTypeId : null;
  const runtimeValues = Array.isArray(manifest.runtimes) ? manifest.runtimes : [];
  if (runtimeValues.some(runtime => !isRuntime(runtime))) throw new Error("Game manifest contains an unsupported runtime id.");
  const runtimes = [...new Set(runtimeValues as GameRuntimeId[])];
  if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(id)) throw new Error("Game id must be a 2-48 character lowercase slug.");
  if (!name || name.length > 80) throw new Error("Game name is required and must be at most 80 characters.");
  if (description.length > 500) throw new Error("Game description must be at most 500 characters.");
  if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(version)) throw new Error("Game version must use semantic version format.");
  if (!gameType) throw new Error("This package uses an unsupported game type.");
  if (runtimes.length === 0) throw new Error("Game manifest must target at least one supported runtime.");
  if (runtimes.some(runtime => !gameTypeRuntimes[gameType].includes(runtime))) {
    throw new Error(`The ${gameType} game type is not implemented for every declared runtime.`);
  }
  return { id, name, description, version, runtimes, gameType };
}

export function validateGamePackageDocument(value: unknown): GamePackageDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Game package must be a JSON object.");
  const document = value as Record<string, unknown>;
  const manifest = validateManifest(document.manifest);
  if (!document.configuration || typeof document.configuration !== "object" || Array.isArray(document.configuration)) {
    throw new Error("Game package configuration must be a JSON object.");
  }
  const configuration = document.configuration as Record<string, unknown>;
  if (manifest.gameType === "typing-speed") {
    resolveTypingTextConfig(configuration);
    const rounds = configuration.rounds;
    if (rounds !== undefined && (!Number.isInteger(rounds) || Number(rounds) < 1 || Number(rounds) > 10)) {
      throw new Error("Typing game rounds must be an integer from 1 to 10.");
    }
  }
  if (manifest.gameType === "animal-racing") {
    resolveRacingRosterConfig(configuration);
    const rounds = configuration.rounds;
    if (rounds !== undefined && (!Number.isInteger(rounds) || Number(rounds) < 1 || Number(rounds) > 10)) {
      throw new Error("Racing game rounds must be an integer from 1 to 10.");
    }
  }
  if (manifest.gameType === "ultimate-texas-holdem") {
    resolveUltimateTexasHoldemConfig(configuration);
  }
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_GAME_PACKAGE_BYTES) throw new Error("Game package exceeds the 128 KiB limit.");
  return { manifest, configuration };
}

async function ensureGameDirectories(): Promise<void> {
  await mkdir(gamePackagesRoot, { recursive: true });
}

async function readCatalog(): Promise<GameCatalog> {
  await ensureGameDirectories();
  try {
    const parsed = JSON.parse(await readFile(gameCatalogPath, "utf8")) as Partial<GameCatalog>;
    const games = Array.isArray(parsed.games) ? parsed.games : [];
    const valid: InstalledGamePackage[] = [];
    for (const game of games) {
      try {
        const manifest = validateManifest(game);
        const enabledRuntimes = Array.isArray(game.enabledRuntimes) ? [...new Set(game.enabledRuntimes.filter(isRuntime))] : [];
        valid.push({ ...manifest, enabledRuntimes: enabledRuntimes.filter(runtime => manifest.runtimes.includes(runtime)) });
      } catch {
        // Invalid catalog entries are ignored and can be repaired through re-import.
      }
    }
    return { schemaVersion: 1, games: valid };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schemaVersion: 1, games: [] };
    throw error;
  }
}

async function writeCatalog(catalog: GameCatalog): Promise<void> {
  await ensureGameDirectories();
  const temporaryPath = `${gameCatalogPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  await rename(temporaryPath, gameCatalogPath);
}

function serializeCatalogOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = catalogQueue.then(operation, operation);
  catalogQueue = result.then(() => undefined, () => undefined);
  return result;
}

export async function listGamePackages(): Promise<{ installed: InstalledGamePackage[]; available: GamePackageManifest[] }> {
  const catalog = await readCatalog();
  const availableById = new Map<string, GamePackageManifest>();
  try {
    for (const item of await readdir(bundledGamesRoot, { withFileTypes: true })) {
      if (!item.isFile() || !item.name.toLowerCase().endsWith(".uragegame.json")) continue;
      try {
        const packageDocument = validateGamePackageDocument(JSON.parse(await readFile(path.join(bundledGamesRoot, item.name), "utf8")));
        availableById.set(packageDocument.manifest.id, packageDocument.manifest);
      } catch {
        // Invalid bundled packages are omitted from the import picker.
      }
    }
  } catch {
    // Installed games remain manageable when no bundled package directory is present.
  }
  for (const game of catalog.games) availableById.delete(game.id);
  return { installed: catalog.games, available: [...availableById.values()] };
}

export async function getInstalledGamePackage(gameId: string): Promise<{ packageInfo: InstalledGamePackage; configuration: Record<string, unknown> } | null> {
  if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(gameId)) return null;
  const catalog = await readCatalog();
  const packageInfo = catalog.games.find(game => game.id === gameId);
  if (!packageInfo) return null;
  try {
    const packagePath = path.resolve(gamePackagesRoot, gameId, "game.json");
    if (!packagePath.startsWith(`${gamePackagesRoot}${path.sep}`)) return null;
    const document = validateGamePackageDocument(JSON.parse(await readFile(packagePath, "utf8")));
    return { packageInfo, configuration: document.configuration };
  } catch {
    return null;
  }
}

export async function importGamePackage(gameId: string): Promise<InstalledGamePackage> {
  return serializeCatalogOperation(async () => {
    if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(gameId)) throw new Error("Invalid game id.");
    const catalog = await readCatalog();
    if (catalog.games.some(game => game.id === gameId)) throw new Error("That game is already installed.");
    const bundledPath = path.resolve(bundledGamesRoot, `${gameId}.uragegame.json`);
    if (!bundledPath.startsWith(`${bundledGamesRoot}${path.sep}`)) throw new Error("Invalid game package path.");
    const document = validateGamePackageDocument(JSON.parse(await readFile(bundledPath, "utf8")));
    if (document.manifest.id !== gameId) throw new Error("Bundled game id does not match its package name.");
    return writeGameDocument(document, catalog);
  });
}

export async function installUploadedGamePackage(value: unknown): Promise<InstalledGamePackage> {
  const document = validateGamePackageDocument(value);
  return serializeCatalogOperation(async () => {
    const catalog = await readCatalog();
    if (catalog.games.some(game => game.id === document.manifest.id)) throw new Error("A game with that id is already installed.");
    return writeGameDocument(document, catalog);
  });
}

async function writeGameDocument(document: GamePackageDocument, catalog: GameCatalog): Promise<InstalledGamePackage> {
  const installedPath = path.resolve(gamePackagesRoot, document.manifest.id);
  if (!installedPath.startsWith(`${gamePackagesRoot}${path.sep}`)) throw new Error("Invalid game package path.");
  await mkdir(installedPath, { recursive: false });
  try {
    await writeFile(path.join(installedPath, "game.json"), JSON.stringify(document, null, 2), "utf8");
    const installed: InstalledGamePackage = { ...document.manifest, enabledRuntimes: [] };
    catalog.games.push(installed);
    await writeCatalog(catalog);
    return installed;
  } catch (error) {
    await rm(installedPath, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export async function setGameRuntimeEnabled(gameId: string, runtime: GameRuntimeId, enabled: boolean): Promise<InstalledGamePackage> {
  return serializeCatalogOperation(async () => {
    const catalog = await readCatalog();
    const game = catalog.games.find(item => item.id === gameId);
    if (!game) throw new Error("Installed game was not found.");
    if (!game.runtimes.includes(runtime)) throw new Error("This game package does not support that runtime.");
    game.enabledRuntimes = enabled
      ? [...new Set([...game.enabledRuntimes, runtime])]
      : game.enabledRuntimes.filter(value => value !== runtime);
    await writeCatalog(catalog);
    return game;
  });
}

export async function updateGameConfiguration(gameId: string, configuration: unknown): Promise<Record<string, unknown>> {
  return serializeCatalogOperation(async () => {
    if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(gameId)) throw new Error("Invalid game id.");
    const catalog = await readCatalog();
    const game = catalog.games.find(item => item.id === gameId);
    if (!game) throw new Error("Installed game was not found.");
    const packagePath = path.resolve(gamePackagesRoot, gameId, "game.json");
    if (!packagePath.startsWith(`${gamePackagesRoot}${path.sep}`)) throw new Error("Invalid game package path.");
    const existing = validateGamePackageDocument(JSON.parse(await readFile(packagePath, "utf8")));
    if (existing.manifest.id !== gameId) throw new Error("Installed package id does not match its catalog entry.");
    const updated = validateGamePackageDocument({ manifest: existing.manifest, configuration });
    const temporaryPath = `${packagePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await writeFile(temporaryPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
      await rename(temporaryPath, packagePath);
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
    return updated.configuration;
  });
}

export async function deleteGamePackage(gameId: string): Promise<void> {
  return serializeCatalogOperation(async () => {
    if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(gameId)) throw new Error("Invalid game id.");
    const catalog = await readCatalog();
    if (!catalog.games.some(game => game.id === gameId)) throw new Error("Installed game was not found.");
    catalog.games = catalog.games.filter(game => game.id !== gameId);
    await writeCatalog(catalog);
    const packagePath = path.resolve(gamePackagesRoot, gameId);
    if (!packagePath.startsWith(`${gamePackagesRoot}${path.sep}`)) throw new Error("Invalid game package path.");
    await rm(packagePath, { recursive: true, force: true });
  });
}
